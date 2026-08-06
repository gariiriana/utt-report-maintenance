import { useState, useEffect } from 'react';
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

export function FindingArchive() {
  const { user, userRole } = useAuth();
  const canDelete = userRole === 'admin' || userRole === 'engineer' || userRole === 'standby_engineer';

  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterMonth, setFilterMonth] = useState<string>(''); 
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

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

    const privilegedRoles = ['admin', 'manager', 'site_manager', 'hse', 'dirut', 'direksiSDM', 'DireksiKeuangan'];
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

  const filtered = findings.filter((f) => {
    const matchesSearch = !searchQuery || [
      f.partName, f.partNumber, f.brandName, f.remark
    ].some(val => val?.toLowerCase().includes(searchQuery.toLowerCase()));

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-teal-600" />
            Arsip Temuan Maintenance
          </h1>
          <p className="text-slate-600 font-medium text-sm mt-1">
            Riwayat dokumentasi dan history temuan maintenance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {findings.length > 0 && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportPDF}
                disabled={exporting !== null}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl flex items-center gap-2 border border-red-200 transition text-sm disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export PDF
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportWord}
                disabled={exporting !== null}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center gap-2 border border-blue-200 transition text-sm disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {exporting === 'word' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export Word
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari di arsip (nama part, nomor part, dll)..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-slate-900 font-bold text-sm outline-none cursor-pointer pr-2"
            >
              <option value="" className="bg-white text-slate-900 font-bold">Semua Bulan</option>
              {months.map(m => (
                <option key={m.value} value={m.value} className="bg-white text-slate-900 font-bold">{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <Layers className="w-4 h-4 text-teal-600" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-transparent text-slate-900 font-bold text-sm outline-none cursor-pointer pr-2"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white text-slate-900 font-bold">{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/90 rounded-2xl border border-sky-100/90 shadow-md">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">Arsip Kosong</h3>
          <p className="text-slate-500 mt-2 font-medium">
            {searchQuery ? 'Tidak ada data di arsip yang cocok.' : 'Belum ada data temuan yang tersimpan di arsip.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-600">
              Total <span className="text-slate-900 font-black">{filtered.length}</span> temuan dalam arsip
            </p>
          </div>

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

                        {canDelete && (finding.createdBy === user?.uid || userRole === 'admin') && (
                          <button
                            onClick={() => setDeleteId(finding.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition border border-red-200 opacity-0 group-hover:opacity-100 shadow-sm"
                            title="Hapus Temuan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
        </>
      )}

      {}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus dari Arsip?</h3>
                <p className="text-slate-500 mb-6">
                  Yakin ingin menghapus temuan ini dari arsip?
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

