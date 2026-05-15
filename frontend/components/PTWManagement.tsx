import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clipboard as ClipboardIcon, Plus, Search, Trash2, Edit2,
  X, CheckCircle2, Loader2, Calendar, Hash, Package,
  AlertCircle, Download, FileUp, File, ChevronDown
} from 'lucide-react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, query, orderBy, serverTimestamp, Timestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const CHUNK_SIZE = 524286; // ~512KB per chunk

interface PTWRecord {
  id: string;
  ptwNumber: string;
  sequenceNumber: number;
  equipmentCode: string;
  quarter: string;
  startDate: string;
  endDate: string;
  notes?: string;
  fileName?: string;
  totalChunks?: number;
  createdBy: string;
  createdAt: Timestamp;
}

export function PTWManagement() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PTWRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<PTWRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<PTWRecord | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(true);

  const [formData, setFormData] = useState({
    sequenceNumber: '',
    equipmentCode: '',
    quarter: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const chunkToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File terlalu besar. Maksimal 10MB.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleDownload = async (record: PTWRecord) => {
    if (!record.fileName || !record.totalChunks) return;
    const toastId = toast.loading('Menyiapkan unduhan...');
    try {
      const chunksSnap = await getDocs(
        query(collection(db, 'ptw_records', record.id, 'chunks'), orderBy('index'))
      );
      if (chunksSnap.empty) { toast.error('File tidak ditemukan', { id: toastId }); return; }

      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';
      chunksSnap.docs.forEach((d) => {
        const chunkData = d.data().data as string;
        let base64Part = chunkData;
        if (chunkData.includes(';base64,')) {
          const parts = chunkData.split(';base64,');
          mimeString = parts[0].split(':')[1] || mimeString;
          base64Part = parts[1];
        }
        const byteStr = atob(base64Part);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        byteArrays.push(bytes);
      });

      const blob = new Blob(byteArrays as any[], { type: mimeString });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('File berhasil diunduh!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh file', { id: toastId });
    }
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isAddModalOpen || isEditModalOpen || isDeleteModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAddModalOpen, isEditModalOpen, isDeleteModalOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      setShowScrollTop(scrollY > 400);
      setShowScrollBottom(scrollY + windowHeight < documentHeight - 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'ptw_records'), orderBy('sequenceNumber', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PTWRecord[];
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error('Error loading PTW:', error);
      toast.error('Gagal memuat data PTW');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const ptwNum = `TDE/PTW/${formData.sequenceNumber.padStart(4, '0')}`;
      let totalChunks = 0;

      if (isEditModalOpen && selectedRecord) {
        // ===== EDIT FLOW =====
        const updateData: Record<string, any> = {
          sequenceNumber: parseInt(formData.sequenceNumber),
          ptwNumber: ptwNum,
          equipmentCode: formData.equipmentCode,
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes,
          updatedAt: serverTimestamp()
        };

        if (selectedFile) {
          totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

          // Delete old chunks
          if (selectedRecord.totalChunks) {
            const oldChunks = await getDocs(collection(db, 'ptw_records', selectedRecord.id, 'chunks'));
            const delBatch = writeBatch(db);
            oldChunks.docs.forEach(d => delBatch.delete(d.ref));
            await delBatch.commit();
          }

          // Upload new chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            let chunkBase64 = await chunkToBase64(selectedFile.slice(start, end));
            if (i === 0) chunkBase64 = `data:${selectedFile.type};base64,${chunkBase64}`;
            await addDoc(collection(db, 'ptw_records', selectedRecord.id, 'chunks'), { index: i, data: chunkBase64 });
            setUploadProgress(((i + 1) / totalChunks) * 90);
            await new Promise(r => setTimeout(r, 30));
          }

          updateData.fileName = selectedFile.name;
          updateData.totalChunks = totalChunks;
        }

        await updateDoc(doc(db, 'ptw_records', selectedRecord.id), updateData);
        toast.success('PTW berhasil diperbarui');

      } else {
        // ===== ADD FLOW =====
        if (selectedFile) {
          totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        }

        // Create doc first to get ID
        const newDocRef = await addDoc(collection(db, 'ptw_records'), {
          sequenceNumber: parseInt(formData.sequenceNumber),
          ptwNumber: ptwNum,
          equipmentCode: formData.equipmentCode,
          quarter: formData.quarter,
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes,
          ...(selectedFile && { fileName: selectedFile.name, totalChunks }),
          createdBy: user.email,
          createdAt: serverTimestamp()
        });

        // Upload chunks to new doc
        if (selectedFile) {
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            let chunkBase64 = await chunkToBase64(selectedFile.slice(start, end));
            if (i === 0) chunkBase64 = `data:${selectedFile.type};base64,${chunkBase64}`;
            await addDoc(collection(db, 'ptw_records', newDocRef.id, 'chunks'), { index: i, data: chunkBase64 });
            setUploadProgress(((i + 1) / totalChunks) * 90);
            await new Promise(r => setTimeout(r, 30));
          }
        }
        toast.success('PTW baru berhasil ditambahkan');
      }

      setUploadProgress(100);
      await new Promise(r => setTimeout(r, 300));
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      resetForm();
      setUploadProgress(0);
    } catch (error) {
      console.error('Error saving PTW:', error);
      toast.error('Gagal menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const chunksSnap = await getDocs(collection(db, 'ptw_records', recordToDelete.id, 'chunks'));
      chunksSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'ptw_records', recordToDelete.id));
      await batch.commit();
      toast.success('PTW berhasil dihapus');
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      toast.error('Gagal menghapus data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: PTWRecord) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const openEditModal = (record: PTWRecord) => {
    setSelectedRecord(record);
    setFormData({
      sequenceNumber: record.sequenceNumber.toString(),
      equipmentCode: record.equipmentCode,
      quarter: record.quarter,
      startDate: record.startDate || '',
      endDate: record.endDate || '',
      notes: record.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      sequenceNumber: '',
      equipmentCode: '',
      quarter: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setSelectedRecord(null);
    setSelectedFile(null);
  };

  const filteredRecords = records.filter(r =>
    r.ptwNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.equipmentCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/40 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <ClipboardIcon className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">PTW Management</h1>
              <p className="text-indigo-300 text-sm">Kelola data Permit to Work secara terorganisir</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all border border-indigo-400/30"
          >
            <Plus className="w-5 h-5" />
            Tambah PTW Baru
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Hash className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total PTW</p>
            <p className="text-2xl font-bold text-white">{records.length}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Calendar className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Update Terbaru</p>
            <p className="text-lg font-bold text-white">
              {records.length > 0 ? new Date(records[0].startDate).toLocaleDateString('id-ID') : '-'}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor PTW atau alat..."
            className="w-full h-full pl-12 pr-4 py-4 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition text-white placeholder-slate-500 shadow-xl"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-12 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Memuat data...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Belum ada data PTW ditemukan</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nomor PTW</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Alat / Equipment</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Quarter</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Masa Berlaku</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-800/30 transition group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-white bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                        {record.ptwNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-200 font-medium">{record.equipmentCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300 bg-slate-700/30 px-2.5 py-0.5 rounded border border-slate-600/30">
                        Q{parseInt(record.quarter)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Masa Berlaku</span>
                        <span className="text-white font-medium">
                          {new Date(record.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(record.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {record.fileName && record.totalChunks && (
                          <button
                            onClick={() => handleDownload(record)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition border border-emerald-500/20"
                            title="Download Lampiran"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(record)}
                          className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition border border-blue-500/20"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                         <button
                          onClick={() => handleDelete(record)}
                          className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition border border-red-500/20"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredRecords.map((record) => (
              <div key={record.id} className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-bold text-white bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                    {record.ptwNumber}
                  </span>
                  <span className="text-xs text-slate-300 bg-slate-700/40 px-2.5 py-1 rounded-lg border border-slate-600/30 font-bold">
                    Q{parseInt(record.quarter)}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm text-slate-200 font-medium">{record.equipmentCode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="text-sm text-slate-400">
                      {new Date(record.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(record.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-slate-700/30">
                  {record.fileName && record.totalChunks && (
                    <button
                      onClick={() => handleDownload(record)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition border border-emerald-500/20 text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      File
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(record)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition border border-blue-500/20 text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                   <button
                    onClick={() => handleDelete(record)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition border border-red-500/20 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {createPortal(
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-10 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="fixed inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden my-auto"
              >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ClipboardIcon className="w-6 h-6 text-indigo-400" />
                  {isEditModalOpen ? 'Edit Data PTW' : 'Tambah PTW Baru'}
                </h2>
                <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="p-2 text-slate-400 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Sequence Number</label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                      <input
                        type="number"
                        required
                        value={formData.sequenceNumber}
                        onChange={(e) => setFormData({ ...formData, sequenceNumber: e.target.value })}
                        className="w-full pl-11 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                        placeholder="Contoh: 21"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Quarter</label>
                    <div className="relative group">
                      <select
                        required
                        value={formData.quarter}
                        onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                        className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Pilih Quarter</option>
                        <option value="1" className="bg-slate-900">Q1</option>
                        <option value="2" className="bg-slate-900">Q2</option>
                        <option value="3" className="bg-slate-900">Q3</option>
                        <option value="4" className="bg-slate-900">Q4</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-focus-within:text-indigo-400 transition" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Equipment Code</label>
                  <div className="relative group">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                    <input
                      type="text"
                      required
                      value={formData.equipmentCode}
                      onChange={(e) => setFormData({ ...formData, equipmentCode: e.target.value.toUpperCase() })}
                      className="w-full pl-11 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                      placeholder="Contoh: GATE, AC, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Masa Berlaku (Dari)</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                      <input
                        type="date"
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full pl-11 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Sampai Dengan</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                      <input
                        type="date"
                        required
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full pl-11 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Catatan (Opsional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition h-24 resize-none"
                    placeholder="Masukkan catatan tambahan..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">File Lampiran (Max 10MB)</label>
                  
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-amber-400 leading-tight">
                      FILE PTW YANG DIUPLOAD HARUS YANG SUDAH TTD TDE
                    </p>
                  </div>
                  {isEditModalOpen && selectedRecord?.totalChunks && selectedRecord?.fileName && !selectedFile && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-2">
                      <File className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-emerald-300 truncate flex-1">{selectedRecord.fileName}</span>
                      <button type="button" onClick={() => handleDownload(selectedRecord)} className="text-emerald-400 hover:text-emerald-300">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-3 px-5 py-3.5 bg-white/5 border border-white/10 border-dashed rounded-2xl text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition cursor-pointer">
                    <FileUp className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm truncate">
                      {selectedFile ? selectedFile.name : 'Pilih file untuk dilampirkan...'}
                    </span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                  </label>
                </div>

                {submitting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase px-1">
                      <span>{uploadProgress < 100 ? 'Mengunggah File...' : 'Menyimpan Data...'}</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="bg-indigo-500 h-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-3"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        {isEditModalOpen ? 'Perbarui PTW' : 'Simpan Data PTW'}
                      </>
                    )}
                  </button>
                </div>
              </form>
              </motion.div>
            </div>
          )}

          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteModalOpen(false)}
                className="fixed inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 shadow-2xl p-8 text-center"
              >
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                  <Trash2 className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Hapus Data PTW?</h3>
                <p className="text-slate-400 mb-8">
                  Apakah Anda yakin ingin menghapus data PTW <span className="text-white font-bold">{recordToDelete?.ptwNumber}</span>? 
                  Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={submitting}
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-2xl font-bold shadow-xl shadow-red-900/20 transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Ya, Hapus'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}


        </AnimatePresence>,
        document.body
      )}

      {/* Floating Scroll Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-[99]">
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={scrollToTop}
              className="p-4 bg-indigo-600/40 backdrop-blur-xl border border-indigo-400/30 rounded-2xl shadow-2xl text-white hover:bg-indigo-600 transition-colors group"
              title="Scroll ke Atas"
            >
              <ChevronDown className="w-6 h-6 rotate-180 group-hover:-translate-y-1 transition-transform" />
            </motion.button>
          )}
          {showScrollBottom && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={scrollToBottom}
              className="p-4 bg-slate-800/40 backdrop-blur-xl border border-slate-600/30 rounded-2xl shadow-2xl text-white hover:bg-slate-700 transition-colors group"
              title="Scroll ke Bawah"
            >
              <ChevronDown className="w-6 h-6 group-hover:translate-y-1 transition-transform" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
