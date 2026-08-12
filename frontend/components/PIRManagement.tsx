// ============================================================================
// FILE: frontend/components/PIRManagement.tsx
// Deskripsi: Modul Utama Pengelolaan Laporan PIR (Post Incident Report).
//            Menyediakan antarmuka khusus untuk:
//            - Pembuatan Laporan PIR Baru via wizard multi-step PIRReportFormModal
//            - Arsip dan pencarian cepat riwayat insiden PIR
//            - Ekspor dokumen ke format PDF (Kop Dwimitra + K2/NeutraDC) & DOCX
//            - Pengeditan dan penghapusan data laporan PIR
// ============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Plus,
  Search,
  Calendar,
  FileText,
  FileDown,
  Edit,
  Trash2,
  Loader2,
  User,
  MapPin,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { PIRReportData } from '@/types/pirReportTypes';
import { PIRReportFormModal } from './PIRReportFormModal';
import { generatePIRReportPDF } from '@/utils/PIRReportPdfExport';
import { exportPIRReportToDocx } from '@/utils/docxReportExport';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const INDO_MONTHS = [
  { value: 'all', label: 'Semua Bulan' },
  { value: '0', label: 'Januari' },
  { value: '1', label: 'Februari' },
  { value: '2', label: 'Maret' },
  { value: '3', label: 'April' },
  { value: '4', label: 'Mei' },
  { value: '5', label: 'Juni' },
  { value: '6', label: 'Juli' },
  { value: '7', label: 'Agustus' },
  { value: '8', label: 'September' },
  { value: '9', label: 'Oktober' },
  { value: '10', label: 'November' },
  { value: '11', label: 'Desember' }
];

export function PIRManagement() {
  const { userRole, companyType: authCompanyType } = useAuth();
  const isK2User = userRole === 'Engineer_K2' || userRole === 'engineer_k2' || authCompanyType === 'k2';

  const [reports, setReports] = useState<PIRReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  // Subscribe to PIR reports in Firestore
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'corrective_reports'),
      where('reportType', '==', 'PIR'),
      orderBy('reportedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as PIRReportData[];
        setReports(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching PIR reports:', error);
        toast.error('Gagal memuat data Laporan PIR');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered reports
  const filteredReports = reports.filter((report) => {
    // Query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = report.incidentName?.toLowerCase().includes(q);
      const matchId = report.incidentId?.toLowerCase().includes(q) || report.id?.toLowerCase().includes(q);
      const matchSummary = report.summary?.toLowerCase().includes(q);
      const matchOwner = report.postmortemOwner?.toLowerCase().includes(q) || report.reportAuthors?.toLowerCase().includes(q);
      const matchLocation = (report as any).location?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchSummary && !matchOwner && !matchLocation) {
        return false;
      }
    }

    // Severity filter
    if (selectedSeverity !== 'all') {
      if (report.severityLevel !== selectedSeverity) {
        return false;
      }
    }

    // Date filter
    if (report.incidentDate) {
      const d = new Date(report.incidentDate);
      if (!isNaN(d.getTime())) {
        if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
          return false;
        }
        if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
          return false;
        }
      }
    }

    return true;
  });

  const handleOpenCreate = () => {
    setEditingId(undefined);
    setShowModal(true);
  };

  const handleOpenEdit = (id: string) => {
    setEditingId(id);
    setShowModal(true);
  };

  const handleExportPDF = async (report: PIRReportData) => {
    const effectiveCompanyType = report.companyType || (isK2User ? 'k2' : 'neutra');
    await generatePIRReportPDF({ ...report, companyType: effectiveCompanyType });
  };

  const handleExportDocx = async (report: PIRReportData) => {
    await exportPIRReportToDocx(report);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'corrective_reports', itemToDelete.id));
      toast.success(`Laporan PIR "${itemToDelete.name}" berhasil dihapus`);
    } catch (err) {
      console.error('Error deleting PIR report:', err);
      toast.error('Gagal menghapus laporan PIR');
    } finally {
      setItemToDelete(null);
      setDeleteModalOpen(false);
    }
  };

  const getSeverityBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH':
        return 'bg-red-500/15 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-700 border-amber-200';
      case 'LOW':
        return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      default:
        return 'bg-blue-500/15 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 border-b border-slate-200 pb-5 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            Report PIR (Post Incident Report)
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Laporan Analisis Akar Masalah & Evaluasi Gangguan Data Center {isK2User ? 'K2 Data Centres' : 'NeutraDC'}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenCreate}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Laporan PIR</span>
        </motion.button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama insiden, ID, lokasi, atau penanggung jawab..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
        </div>

        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
          {/* Severity filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition"
          >
            <option value="all">Semua Severity</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Month filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition"
          >
            {INDO_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Year filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition"
          >
            <option value="all">Semua Tahun</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-2" />
          <p className="text-sm font-medium text-slate-500">Memuat Laporan PIR...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/80">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum ada Laporan PIR</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedSeverity !== 'all' || selectedMonth !== 'all'
              ? 'Tidak ada laporan yang sesuai dengan filter pencarian.'
              : 'Klik tombol "Buat Laporan PIR" di atas untuk membuat laporan insiden baru.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredReports.map((report) => {
              const effectiveCompany = report.companyType === 'k2' ? 'K2 Data Centres' : 'NeutraDC';
              return (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/95 backdrop-blur-md border border-slate-200/80 hover:border-amber-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Card: Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${getSeverityBadge(report.severityLevel)}`}>
                        {report.severityLevel || 'LOW'} SEVERITY
                      </span>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {effectiveCompany}
                      </span>
                    </div>

                    {/* Incident Title */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                        {report.incidentName || 'Postmortem Incident Report'}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ID: {report.incidentId || report.id?.slice(0, 8)}
                      </p>
                    </div>

                    {/* Metadata items */}
                    <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{report.incidentDate || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{report.postmortemOwner || report.reportAuthors || 'Standby Engineer'}</span>
                      </div>
                      {(report as any).location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{(report as any).location}</span>
                        </div>
                      )}
                    </div>

                    {/* Summary Snippet */}
                    {report.summary && (
                      <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        {report.summary}
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-4 gap-1.5">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleExportPDF(report)}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold transition cursor-pointer"
                      title="Unduh PDF (Kop Dwimitra + K2/NeutraDC)"
                    >
                      <FileDown className="w-4 h-4 mb-0.5" />
                      <span>PDF</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleExportDocx(report)}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold transition cursor-pointer"
                      title="Unduh Dokumen Word (DOCX)"
                    >
                      <FileText className="w-4 h-4 mb-0.5" />
                      <span>DOCX</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleOpenEdit(report.id!)}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold transition cursor-pointer"
                      title="Sunting Laporan PIR"
                    >
                      <Edit className="w-4 h-4 mb-0.5" />
                      <span>Edit</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setItemToDelete({ id: report.id!, name: report.incidentName || 'Laporan PIR' });
                        setDeleteModalOpen(true);
                      }}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 text-[10px] font-bold transition cursor-pointer"
                      title="Hapus Laporan PIR"
                    >
                      <Trash2 className="w-4 h-4 mb-0.5" />
                      <span>Hapus</span>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* PIR Modal Form */}
      {showModal && (
        <PIRReportFormModal
          editId={editingId}
          onSuccess={() => {
            setShowModal(false);
            setEditingId(undefined);
          }}
          onCancel={() => {
            setShowModal(false);
            setEditingId(undefined);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        documentName={itemToDelete?.name || 'Laporan PIR'}
      />
    </div>
  );
}
