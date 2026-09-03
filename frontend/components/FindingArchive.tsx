// ============================================================================
// FILE: FindingArchive.tsx
// Deskripsi: Modul Arsip Dokumen Temuan Pemeliharaan (Finding Archive Viewer).
//            Menyajikan riwayat daftar temuan perangkat terorganisir per folder bulan/tahun,
//            fitur pencarian real-time (Nama Part / No. Part), preview foto bukti temuan,
//            serta ekspor langsung laporan temuan ke format PDF & Word (.docx).
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trash2,
  Loader2,
  Search,
  FileText,
  FileDown,
  Package,
  Hash,
  Tag,
  Layers,
  CalendarDays,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import {
  collection,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  where,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { exportFindingsToPDF } from '../utils/FindingPdfExport';
import { exportFindingsToWord } from '../utils/FindingWordExport';
import { FindingRecord } from '../types/finding';

function getQuarter(createdAt: any): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  if (!createdAt) return 'Q1';
  let date: Date;
  if (typeof createdAt.toDate === 'function') {
    date = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else {
    date = new Date(createdAt);
  }
  if (isNaN(date.getTime())) return 'Q1';
  const m = date.getMonth(); // 0 to 11
  if (m >= 0 && m <= 2) return 'Q1';
  if (m >= 3 && m <= 5) return 'Q2';
  if (m >= 6 && m <= 8) return 'Q3';
  return 'Q4';
}

const QUARTER_INFO = [
  { id: 'Q1', name: 'Q1 (Januari - Maret)', desc: 'Laporan Temuan Triwulan 1' },
  { id: 'Q2', name: 'Q2 (April - Juni)', desc: 'Laporan Temuan Triwulan 2' },
  { id: 'Q3', name: 'Q3 (Juli - September)', desc: 'Laporan Temuan Triwulan 3' },
  { id: 'Q4', name: 'Q4 (Oktober - Desember)', desc: 'Laporan Temuan Triwulan 4' },
] as const;

export function FindingArchive() {
  const { user, userRole } = useAuth();
  const canDelete = userRole === 'admin' || userRole === 'qc_dme' || userRole === 'engineer' || userRole === 'standby_engineer';

  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Folder navigation state
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | null>(null);

  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedAccount && !selectedQuarter) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTimeout(() => {
      if (containerRef.current) {
        const navOffset = 80;
        const elementPosition = containerRef.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
    }, 50);
  }, [selectedAccount, selectedQuarter]);

  const months = [
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
    { value: '11', label: 'Desember' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    if (!user) return;

    const privilegedRoles = ['admin', 'manager', 'site_manager', 'hse', 'dirut', 'direksiSDM', 'DireksiKeuangan', 'DME'];
    const isPrivileged = (userRole && privilegedRoles.includes(userRole)) || (user?.email && user.email.toLowerCase().includes('dwimitra'));

    let q;
    if (isPrivileged) {
      q = query(collection(db, 'findings'));
    } else {
      q = query(
        collection(db, 'findings'),
        where('createdBy', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FindingRecord[];

        const sortedData = [...data].sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });

        setFindings(sortedData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading findings:', error);
        toast.error('Gagal memuat arsip temuan');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, userRole]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'findings', deleteId));
      toast.success('Temuan berhasil dihapus dari arsip');
    } catch {
      toast.error('Gagal menghapus temuan');
    } finally {
      setDeleteId(null);
    }
  };

  // Extract unique accounts
  const uniqueAccounts = Array.from(
    new Set(findings.map((f) => (f.createdByEmail || 'Akun Engineer').toLowerCase()))
  ).sort();

  // Filter findings based on selected account, quarter, search, and filters
  const privilegedRoles = ['admin', 'manager', 'site_manager', 'hse', 'dirut', 'direksiSDM', 'DireksiKeuangan', 'DME'];
  const isPrivilegedUser = (userRole && privilegedRoles.includes(userRole)) || (user?.email && user.email.toLowerCase().includes('dwimitra'));

  const filtered = findings.filter((f) => {
    if (!isPrivilegedUser) {
      const userEmailClean = (user?.email || '').toLowerCase().trim();
      if ((f.createdByEmail || '').toLowerCase().trim() !== userEmailClean && f.createdBy !== user?.uid) {
        return false;
      }
    }

    if (!searchQuery.trim()) {
      if (selectedAccount && (f.createdByEmail || '').toLowerCase() !== selectedAccount.toLowerCase()) {
        return false;
      }
      if (selectedQuarter && getQuarter(f.createdAt) !== selectedQuarter) {
        return false;
      }
    }

    const matchesSearch =
      !searchQuery ||
      [f.partName, f.partNumber, f.brandName, f.remark, f.createdByEmail].some((val) =>
        val?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!matchesSearch) return false;

    if (!f.createdAt) return true;
    const date = f.createdAt.toDate ? f.createdAt.toDate() : new Date(f.createdAt as any);

    const matchesMonth = filterMonth === '' || date.getMonth().toString() === filterMonth;
    const matchesYear = filterYear === '' || date.getFullYear().toString() === filterYear;

    return matchesMonth && matchesYear;
  });

  const handleExportPDF = async () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada data untuk di-export');
      return;
    }
    setExporting('pdf');
    try {
      await exportFindingsToPDF(filtered);
      toast.success('PDF Berhasil di-export!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal export PDF');
    } finally {
      setExporting(null);
    }
  };

  const handleExportWord = async () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada data untuk di-export');
      return;
    }
    setExporting('word');
    try {
      await exportFindingsToWord(filtered);
      toast.success('Word Berhasil di-export!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal export Word');
    } finally {
      setExporting(null);
    }
  };

  const handleExportSinglePDF = async (finding: FindingRecord) => {
    try {
      toast.loading(`Mengunduh PDF temuan "${finding.partName}"...`, { id: 'single-pdf' });
      await exportFindingsToPDF([finding]);
      toast.success('PDF Temuan berhasil di-export!', { id: 'single-pdf' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal export PDF temuan', { id: 'single-pdf' });
    }
  };

  const handleExportSingleWord = async (finding: FindingRecord) => {
    try {
      toast.loading(`Mengunduh Word temuan "${finding.partName}"...`, { id: 'single-word' });
      await exportFindingsToWord([finding]);
      toast.success('Word Temuan berhasil di-export!', { id: 'single-word' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal export Word temuan', { id: 'single-word' });
    }
  };

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative scroll-mt-20">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-teal-600" />
            Arsip Temuan Maintenance
          </h1>
          <p className="text-slate-600 font-medium text-sm mt-1">
            Riwayat dokumentasi dan history temuan maintenance per Akun Engineer & Triwulan (Q1-Q4)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filtered.length > 0 && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportPDF}
                disabled={exporting !== null}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl flex items-center gap-2 border border-red-200 transition text-xs sm:text-sm disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export PDF ({filtered.length})
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportWord}
                disabled={exporting !== null}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center gap-2 border border-blue-200 transition text-xs sm:text-sm disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {exporting === 'word' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export Word ({filtered.length})
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Search & Date Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari di arsip (nama part, nomor part, akun engineer)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-slate-900 font-bold text-xs outline-none cursor-pointer pr-2"
            >
              <option value="" className="bg-white text-slate-900 font-bold">Semua Bulan</option>
              {months.map((m) => (
                <option key={m.value} value={m.value} className="bg-white text-slate-900 font-bold">{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Layers className="w-4 h-4 text-teal-600" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-transparent text-slate-900 font-bold text-xs outline-none cursor-pointer pr-2"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-white text-slate-900 font-bold">{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {/* LEVEL 1: ACCOUNT FOLDERS (When no account selected & no search) */}
          {!searchQuery.trim() && !selectedAccount && (
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <Folder className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Folder Akun Engineer Maintenance</h3>
                    <p className="text-xs text-slate-500 font-medium">Pilih akun engineer untuk melihat laporan temuan triwulan (Q1 - Q4)</p>
                  </div>
                </div>
              </div>

              {uniqueAccounts.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Belum ada akun engineer yang mengunggah temuan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {uniqueAccounts.map((account) => {
                    const count = findings.filter(
                      (f) => (f.createdByEmail || '').toLowerCase() === account.toLowerCase()
                    ).length;
                    return (
                      <motion.button
                        key={account}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setSelectedAccount(account);
                          setSelectedQuarter(null);
                        }}
                        className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
                      >
                        <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                          <Folder className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                            {account}
                          </span>
                          <span className="text-xs font-medium text-slate-500 block mt-0.5">
                            {count} Laporan Temuan
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 2: QUARTER FOLDERS (When account is selected, but quarter is null & no search) */}
          {!searchQuery.trim() && selectedAccount && !selectedQuarter && (
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccount(null);
                    setSelectedQuarter(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Akun
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Akun:</span>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-xs font-bold">
                    {selectedAccount}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {QUARTER_INFO.map((qInfo) => {
                  const qCount = findings.filter(
                    (f) =>
                      (f.createdByEmail || '').toLowerCase() === selectedAccount.toLowerCase() &&
                      getQuarter(f.createdAt) === qInfo.id
                  ).length;

                  return (
                    <motion.button
                      key={qInfo.id}
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedQuarter(qInfo.id)}
                      className="p-4 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 bg-teal-50 rounded-xl group-hover:bg-teal-100 transition-colors">
                          <Folder className="w-6 h-6 text-teal-600" />
                        </div>
                        <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-200">
                          {qCount} File
                        </span>
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                          {qInfo.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{qInfo.desc}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 3: FILE LIST (When account & quarter selected OR searching) */}
          {(!!searchQuery.trim() || (selectedAccount && selectedQuarter)) && (
            <div className="space-y-4">
              {/* Navigation Breadcrumb inside File List */}
              {!searchQuery.trim() && selectedAccount && selectedQuarter && (
                <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedQuarter(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 shadow-xs"
                    >
                      <ChevronLeft className="w-4 h-4" /> Kembali ke Q1-Q4
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">Lokasi:</span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">
                      {selectedAccount}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="px-2.5 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-md border border-teal-200">
                      {selectedQuarter} ({filtered.length} File)
                    </span>
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white/90 rounded-2xl border border-sky-100/90 shadow-md">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900">Arsip Kosong</h3>
                  <p className="text-slate-500 mt-2 font-medium">
                    {searchQuery
                      ? `Tidak ada data di arsip yang cocok dengan "${searchQuery}".`
                      : 'Belum ada data temuan yang tersimpan di folder ini.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filtered.map((finding, idx) => (
                    <motion.div
                      key={finding.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-white/90 backdrop-blur-sm rounded-xl border border-sky-100/90 overflow-hidden hover:border-teal-400 transition group shadow-md text-slate-800"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col md:flex-row gap-5">
                          {/* Photos */}
                          {finding.photos && finding.photos.length > 0 && (
                            <div className="flex gap-2 flex-shrink-0 overflow-x-auto">
                              {finding.photos.slice(0, 3).map((photo, pIdx) => (
                                <div key={pIdx} className="relative flex-shrink-0">
                                  <img
                                    src={photo.base64}
                                    alt={photo.description || `Photo ${pIdx + 1}`}
                                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-slate-200"
                                  />
                                  {photo.description && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 px-1.5 py-0.5 rounded-b-lg">
                                      <p className="text-[10px] text-white truncate">{photo.description}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {finding.photos.length > 3 && (
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-teal-600 text-sm font-black">+{finding.photos.length - 3}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                              <div>
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-teal-600" />
                                  {finding.partName}
                                </h3>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Hash className="w-3 h-3" /> {finding.partNumber}
                                  </span>
                                  {finding.brandName && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                      <Tag className="w-3 h-3" /> {finding.brandName}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Layers className="w-3 h-3" /> Qty: {finding.quantity}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleExportSinglePDF(finding)}
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                                  title="Export PDF Temuan Ini"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportSingleWord(finding)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                                  title="Export Word Temuan Ini"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  <span>DOCX</span>
                                </button>

                                {canDelete && (finding.createdBy === user?.uid || userRole === 'admin' || userRole === 'qc_dme') && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteId(finding.id)}
                                    className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition border border-slate-200 shadow-xs cursor-pointer"
                                    title="Hapus Temuan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {finding.remark && (
                              <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border-l-2 border-teal-500">
                                <p className="text-sm text-slate-800 font-medium">{finding.remark}</p>
                              </div>
                            )}

                            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <CalendarDays className="w-3 h-3" />
                              <span>
                                Input: {finding.createdAt?.toDate?.()?.toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                }) || '-'}
                              </span>
                              <span>•</span>
                              <span className="text-slate-600 font-bold">{finding.createdByEmail}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">Hapus Data Temuan?</h3>
              <p className="text-sm text-slate-500">
                Apakah Anda yakin ingin menghapus data temuan ini dari arsip? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-red-500/20 cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
