// ============================================================================
// FILE: frontend/components/SOPEOPManagement.tsx
// Deskripsi: Modul Manajemen SOP & EOP Khusus Akun PT Dwimitra Ekatama Mandiri.
//            Menyediakan Form interaktif SOP (14 Seksi), Form interaktif EOP (8 Seksi),
//            Penyimpanan Arsip Cloud di Firestore, serta Ekspor 1:1 ke Word (.docx).
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Save,
  RotateCcw,
  BookOpen,
  Search,
  Edit3,
  Zap,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Globe,
  CheckCircle2,
  UploadCloud
} from 'lucide-react';
import { toast } from 'sonner';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from '@/components/AuthContext';
import {
  SOPDocumentData,
  EOPDocumentData,
  SOPCIEquipmentItem,
  SOPReferencedDocItem,
  SOPPrerequisiteItem,
  SOPWorkStepItem,
  EOPWorkStepItem,
  DocumentSigner,
  DEFAULT_SOP_DATA,
  DEFAULT_EOP_DATA
} from '@/types/sopEopTypes';
import { exportSOPToDocx, exportEOPToDocx } from '@/utils/sopEopDocxExport';
import { convertSOPToBilingualWithAI, convertEOPToBilingualWithAI } from '@/utils/sopEopBilingualAI';
import { importSopEopFromDocx } from '@/utils/sopEopDocxImport';

type SubTab = 'sop' | 'eop' | 'archive';

export function SOPEOPManagement() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('sop');

  // File import ref & state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // State SOP
  const [sopData, setSopData] = useState<SOPDocumentData>(() => ({ ...DEFAULT_SOP_DATA }));
  const [currentSopDocId, setCurrentSopDocId] = useState<string | null>(null);
  const [isExportingSop, setIsExportingSop] = useState(false);
  const [isSavingSop, setIsSavingSop] = useState(false);
  const [isBilingualSop, setIsBilingualSop] = useState(false);

  // State EOP
  const [eopData, setEopData] = useState<EOPDocumentData>(() => ({ ...DEFAULT_EOP_DATA }));
  const [currentEopDocId, setCurrentEopDocId] = useState<string | null>(null);
  const [isExportingEop, setIsExportingEop] = useState(false);
  const [isSavingEop, setIsSavingEop] = useState(false);
  const [isBilingualEop, setIsBilingualEop] = useState(false);

  // State Arsip
  const [archiveList, setArchiveList] = useState<Array<(SOPDocumentData | EOPDocumentData) & { id: string }>>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFilterType, setArchiveFilterType] = useState<'ALL' | 'SOP' | 'EOP'>('ALL');

  // Handle File Import (.docx)
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsImporting(true);
    const loadingToast = toast.loading(`Membaca & menganalisis berkas "${file.name}"...`);
    try {
      const result = await importSopEopFromDocx(file);
      toast.dismiss(loadingToast);

      if (result.type === 'SOP' && result.sopData) {
        setSopData(result.sopData);
        setCurrentSopDocId(null);
        setActiveSubTab('sop');
        toast.success(
          `Berkas SOP "${file.name}" berhasil diimpor! Terisi otomatis: 14 Seksi, ${result.summary.stepCount} Langkah Kerja, ${result.summary.equipmentCount || 0} Peralatan CI.`
        );
      } else if (result.type === 'EOP' && result.eopData) {
        setEopData(result.eopData);
        setCurrentEopDocId(null);
        setActiveSubTab('eop');
        toast.success(
          `Berkas EOP "${file.name}" berhasil diimpor! Terisi otomatis: 8 Seksi, ${result.summary.stepCount} Langkah Kedaruratan.`
        );
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error('Gagal mengimpor berkas Word:', err);
      toast.error(`Gagal mengimpor berkas Word: ${err?.message || 'Format berkas tidak dikenali'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Load Archive from Firestore
  const fetchArchive = async () => {
    setIsLoadingArchive(true);
    try {
      const q = query(collection(db, 'sop_eop_documents'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const docs: Array<(SOPDocumentData | EOPDocumentData) & { id: string }> = [];
      snap.forEach((d) => {
        docs.push({ id: d.id, ...d.data() } as any);
      });
      setArchiveList(docs);
    } catch (err: any) {
      console.warn('Error fetching SOP/EOP archive:', err);
      // Fallback query if index or timestamp is missing
      try {
        const snap2 = await getDocs(collection(db, 'sop_eop_documents'));
        const docs2: Array<(SOPDocumentData | EOPDocumentData) & { id: string }> = [];
        snap2.forEach((d) => {
          docs2.push({ id: d.id, ...d.data() } as any);
        });
        setArchiveList(docs2);
      } catch (e2: any) {
        console.warn('Fallback fetch SOP/EOP archive note:', e2);
      }
    } finally {
      setIsLoadingArchive(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'archive') {
      fetchArchive();
    }
  }, [activeSubTab]);

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS: SOP FORM
  // ──────────────────────────────────────────────────────────────────────────

  const handleResetSop = () => {
    if (confirm('Muat ulang template default Standar Trafo Trafindo untuk SOP? Perubahan yang belum disimpan akan hilang.')) {
      setSopData({ ...DEFAULT_SOP_DATA });
      setCurrentSopDocId(null);
      toast.success('Template SOP Trafindo berhasil dimuat');
    }
  };

  const handleExportSop = async () => {
    try {
      setIsExportingSop(true);
      toast.info('Menyiapkan berkas Word (.docx) SOP...');
      await exportSOPToDocx(sopData);
      toast.success('Dokumen SOP (.docx) berhasil diekspor!');
    } catch (err: any) {
      console.error('Gagal mengekspor SOP:', err);
      toast.error(`Gagal mengekspor Word SOP: ${err?.message || err}`);
    } finally {
      setIsExportingSop(false);
    }
  };

  const handleBilingualSop = async () => {
    try {
      setIsBilingualSop(true);
      const toastId = toast.loading('🤖 AI Agent sedang menyelaraskan format bilingual (EN + ID) untuk SOP...');
      const result = await convertSOPToBilingualWithAI(sopData, (msg) => {
        toast.loading(`🤖 ${msg}`, { id: toastId });
      });
      setSopData(result);
      toast.success('🎉 Format Bilingual (EN + ID) untuk SOP berhasil diselaraskan!', { id: toastId });
    } catch (err: any) {
      console.error('Bilingual error:', err);
      toast.error(`Gagal menyelaraskan bilingual: ${err?.message || err}`);
    } finally {
      setIsBilingualSop(false);
    }
  };

  const handleSaveSop = async () => {
    try {
      setIsSavingSop(true);
      const payload = {
        ...sopData,
        type: 'SOP',
        author: sopData.author || user?.email || 'dwimitra@co.id',
        updatedAt: serverTimestamp(),
      };

      if (currentSopDocId) {
        await updateDoc(doc(db, 'sop_eop_documents', currentSopDocId), payload);
        toast.success('Dokumen SOP berhasil diperbarui di arsip Cloud!');
      } else {
        const docRef = await addDoc(collection(db, 'sop_eop_documents'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setCurrentSopDocId(docRef.id);
        toast.success('Dokumen SOP baru berhasil disimpan ke arsip Cloud!');
      }
    } catch (err: any) {
      console.error('Gagal menyimpan SOP:', err);
      toast.error(`Gagal menyimpan SOP: ${err?.message || err}`);
    } finally {
      setIsSavingSop(false);
    }
  };

  // SOP Equipment Handlers
  const addEquipmentRow = () => {
    const nextNo = sopData.equipmentList.length + 1;
    setSopData((prev) => ({
      ...prev,
      equipmentList: [
        ...prev.equipmentList,
        {
          no: nextNo,
          classId: 'TR',
          ciName: `TRAFO ${nextNo}`,
          ciDescription: '',
          capacity: '2500 kVA',
          serialNumber: '',
          mfd: new Date().getFullYear().toString(),
          productName: 'TRAFINDO',
          model: 'Dry Type Cast Resin',
          room: 'Trafo Room'
        }
      ]
    }));
  };

  const removeEquipmentRow = (index: number) => {
    setSopData((prev) => {
      const updated = prev.equipmentList.filter((_, idx) => idx !== index);
      return {
        ...prev,
        equipmentList: updated.map((item, idx) => ({ ...item, no: idx + 1 }))
      };
    });
  };

  const updateEquipmentItem = (index: number, field: keyof SOPCIEquipmentItem, value: any) => {
    setSopData((prev) => {
      const updated = [...prev.equipmentList];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, equipmentList: updated };
    });
  };

  // SOP Affected Systems Checkbox
  const toggleAffectedSystem = (key: string) => {
    setSopData((prev) => ({
      ...prev,
      affectedSystems: prev.affectedSystems.map((item) =>
        item.key === key ? { ...item, checked: !item.checked } : item
      )
    }));
  };

  // SOP Referenced Documents
  const addReferencedDoc = () => {
    setSopData((prev) => ({
      ...prev,
      referencedDocuments: [
        ...prev.referencedDocuments,
        { name: '', number: '' }
      ]
    }));
  };

  const removeReferencedDoc = (index: number) => {
    setSopData((prev) => ({
      ...prev,
      referencedDocuments: prev.referencedDocuments.filter((_, idx) => idx !== index)
    }));
  };

  const updateReferencedDoc = (index: number, field: keyof SOPReferencedDocItem, value: string) => {
    setSopData((prev) => {
      const updated = [...prev.referencedDocuments];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, referencedDocuments: updated };
    });
  };

  // SOP Prerequisites Handlers
  const updatePrerequisiteItem = (index: number, field: keyof SOPPrerequisiteItem, value: string) => {
    setSopData((prev) => {
      const updated = [...prev.prerequisites];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prerequisites: updated };
    });
  };

  // SOP Work Steps Handlers
  const addSopWorkStep = (insertAfterIndex?: number) => {
    setSopData((prev) => {
      const newStep: SOPWorkStepItem = {
        no: 0,
        actionEn: '',
        actionId: '',
        expectedOutcomeEn: '',
        expectedOutcomeId: '',
        time: '',
        initial: ''
      };
      let updated: SOPWorkStepItem[];
      if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) {
        updated = [...prev.workSteps];
        updated.splice(insertAfterIndex + 1, 0, newStep);
      } else {
        updated = [...prev.workSteps, newStep];
      }
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const removeSopWorkStep = (index: number) => {
    setSopData((prev) => {
      const updated = prev.workSteps.filter((_, idx) => idx !== index);
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const moveSopWorkStep = (index: number, direction: 'up' | 'down') => {
    setSopData((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.workSteps.length) return prev;
      const updated = [...prev.workSteps];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const updateSopWorkStep = (index: number, field: keyof SOPWorkStepItem, value: any) => {
    setSopData((prev) => {
      const updated = [...prev.workSteps];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workSteps: updated };
    });
  };

  // SOP Approvals Handlers
  const updateSopApproval = (index: number, field: keyof DocumentSigner, value: string) => {
    setSopData((prev) => {
      const updated = [...prev.approvals];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, approvals: updated };
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS: EOP FORM
  // ──────────────────────────────────────────────────────────────────────────

  const handleResetEop = () => {
    if (confirm('Muat ulang template default Standar Trafo Trafindo untuk EOP? Perubahan yang belum disimpan akan hilang.')) {
      setEopData({ ...DEFAULT_EOP_DATA });
      setCurrentEopDocId(null);
      toast.success('Template EOP Trafindo berhasil dimuat');
    }
  };

  const handleExportEop = async () => {
    try {
      setIsExportingEop(true);
      toast.info('Menyiapkan berkas Word (.docx) EOP...');
      await exportEOPToDocx(eopData);
      toast.success('Dokumen EOP (.docx) berhasil diekspor!');
    } catch (err: any) {
      console.error('Gagal mengekspor EOP:', err);
      toast.error(`Gagal mengekspor Word EOP: ${err?.message || err}`);
    } finally {
      setIsExportingEop(false);
    }
  };

  const handleBilingualEop = async () => {
    try {
      setIsBilingualEop(true);
      const toastId = toast.loading('🤖 AI Agent sedang menyelaraskan format bilingual (EN + ID) untuk EOP...');
      const result = await convertEOPToBilingualWithAI(eopData, (msg) => {
        toast.loading(`🤖 ${msg}`, { id: toastId });
      });
      setEopData(result);
      toast.success('🎉 Format Bilingual (EN + ID) untuk EOP berhasil diselaraskan!', { id: toastId });
    } catch (err: any) {
      console.error('Bilingual error:', err);
      toast.error(`Gagal menyelaraskan bilingual: ${err?.message || err}`);
    } finally {
      setIsBilingualEop(false);
    }
  };

  const handleSaveEop = async () => {
    try {
      setIsSavingEop(true);
      const payload = {
        ...eopData,
        type: 'EOP',
        author: eopData.author || user?.email || 'dwimitra@co.id',
        updatedAt: serverTimestamp(),
      };

      if (currentEopDocId) {
        await updateDoc(doc(db, 'sop_eop_documents', currentEopDocId), payload);
        toast.success('Dokumen EOP berhasil diperbarui di arsip Cloud!');
      } else {
        const docRef = await addDoc(collection(db, 'sop_eop_documents'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setCurrentEopDocId(docRef.id);
        toast.success('Dokumen EOP baru berhasil disimpan ke arsip Cloud!');
      }
    } catch (err: any) {
      console.error('Gagal menyimpan EOP:', err);
      toast.error(`Gagal menyimpan EOP: ${err?.message || err}`);
    } finally {
      setIsSavingEop(false);
    }
  };

  const addEopWorkStep = (insertAfterIndex?: number) => {
    setEopData((prev) => {
      const newStep: EOPWorkStepItem = {
        no: 0,
        actionEn: '',
        actionId: '',
        expectedOutcomeEn: '',
        expectedOutcomeId: '',
        time: '',
        name: ''
      };
      let updated: EOPWorkStepItem[];
      if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) {
        updated = [...prev.workSteps];
        updated.splice(insertAfterIndex + 1, 0, newStep);
      } else {
        updated = [...prev.workSteps, newStep];
      }
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const removeEopWorkStep = (index: number) => {
    setEopData((prev) => {
      const updated = prev.workSteps.filter((_, idx) => idx !== index);
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const moveEopWorkStep = (index: number, direction: 'up' | 'down') => {
    setEopData((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.workSteps.length) return prev;
      const updated = [...prev.workSteps];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return {
        ...prev,
        workSteps: updated.map((step, idx) => ({ ...step, no: idx + 1 }))
      };
    });
  };

  const updateEopWorkStep = (index: number, field: keyof EOPWorkStepItem, value: any) => {
    setEopData((prev) => {
      const updated = [...prev.workSteps];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workSteps: updated };
    });
  };

  const updateEopApproval = (index: number, field: keyof DocumentSigner, value: string) => {
    setEopData((prev) => {
      const updated = [...prev.approvals];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, approvals: updated };
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS: ARSIP DOKUMEN
  // ──────────────────────────────────────────────────────────────────────────

  const handleLoadArchiveDoc = (item: any) => {
    if (item.type === 'SOP') {
      setSopData({ ...item });
      setCurrentSopDocId(item.id);
      setActiveSubTab('sop');
      toast.success(`Dokumen SOP "${item.documentTitle || 'Tanpa Judul'}" dimuat ke formulir`);
    } else {
      setEopData({ ...item });
      setCurrentEopDocId(item.id);
      setActiveSubTab('eop');
      toast.success(`Dokumen EOP "${item.documentTitle || 'Tanpa Judul'}" dimuat ke formulir`);
    }
  };

  const handleDownloadArchiveDoc = async (item: any) => {
    try {
      toast.info(`Menyiapkan download ${item.type}: ${item.documentTitle}...`);
      if (item.type === 'SOP') {
        await exportSOPToDocx(item);
      } else {
        await exportEOPToDocx(item);
      }
      toast.success(`Berhasil mengunduh dokumen ${item.type} (.docx)`);
    } catch (err: any) {
      toast.error(`Gagal mengunduh: ${err?.message || err}`);
    }
  };

  const handleDeleteArchiveDoc = async (id: string, title: string) => {
    if (confirm(`Yakin ingin menghapus dokumen "${title}" dari arsip Cloud? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        await deleteDoc(doc(db, 'sop_eop_documents', id));
        setArchiveList((prev) => prev.filter((d) => d.id !== id));
        if (currentSopDocId === id) setCurrentSopDocId(null);
        if (currentEopDocId === id) setCurrentEopDocId(null);
        toast.success('Dokumen berhasil dihapus dari arsip');
      } catch (err: any) {
        toast.error(`Gagal menghapus: ${err?.message || err}`);
      }
    }
  };

  const filteredArchive = archiveList.filter((item) => {
    const matchesType = archiveFilterType === 'ALL' || item.type === archiveFilterType;
    const q = archiveSearch.toLowerCase();
    const matchesSearch =
      !archiveSearch ||
      (item.documentTitle || '').toLowerCase().includes(q) ||
      (item.author || '').toLowerCase().includes(q) ||
      (item.workLocationEn || '').toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hidden File Input for .docx Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      {/* ─── HEADER UTAMA ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  NeutraDC & DME Cikarang
                </span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Format Word 1:1 Corporate Standard
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                SOP & EOP Management Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Pusat penyusunan, pengelolaan arsip Cloud, dan ekspor instan Dokumen Prosedur Standar (SOP) & Prosedur Darurat (EOP).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-right shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Arsip Cloud</div>
              <div className="text-sm font-black text-slate-800">{archiveList.length} Dokumen</div>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION SWITCHER (SEGMENTED CONTROL PILL BAR) ─── */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="inline-flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 gap-1.5 overflow-x-auto max-w-full scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveSubTab('sop')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'sop'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Form SOP</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeSubTab === 'sop' ? 'bg-red-900/60 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                14 Seksi
              </span>
              {currentSopDocId && <span className="w-2 h-2 rounded-full bg-amber-300 ml-0.5" title="Dokumen Tersimpan"></span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('eop')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'eop'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>Form EOP</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeSubTab === 'eop' ? 'bg-fuchsia-900/60 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                8 Seksi
              </span>
              {currentEopDocId && <span className="w-2 h-2 rounded-full bg-amber-300 ml-0.5" title="Dokumen Tersimpan"></span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('archive')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'archive'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Arsip Dokumen</span>
              {archiveList.length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeSubTab === 'archive' ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {archiveList.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 italic hidden lg:block">
            {activeSubTab === 'sop' && 'Mode penyusunan Standard Operating Procedure (14 Seksi Lengkap)'}
            {activeSubTab === 'eop' && 'Mode penyusunan Emergency Operating Procedure (8 Seksi Kedaruratan)'}
            {activeSubTab === 'archive' && 'Daftar arsip dokumen SOP & EOP tersimpan di Cloud Firestore'}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 1. SUB-TAB: FORMULIR SOP (14 SEKSI)                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'sop' && (
        <div className="space-y-6">
          {/* Action Bar Sticky / Top */}
          <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-3 py-1 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-xs shrink-0">
                SOP Editor
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                  {sopData.documentTitle || 'Form SOP Baru'}
                </span>
                {currentSopDocId && (
                  <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-semibold inline-block mt-0.5">
                    Tersimpan di Cloud • ID: {currentSopDocId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Unggah berkas Word (.docx) SOP/EOP untuk membaca isi berkas dan mengisi form secara otomatis"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
                <span>{isImporting ? 'Membaca...' : 'Import Word (.docx)'}</span>
              </button>

              <button
                type="button"
                onClick={handleBilingualSop}
                disabled={isBilingualSop}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-sm shadow-teal-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Otomatis terjemahkan & selaraskan Bahasa Inggris dan Bahasa Indonesia pada dokumen SOP"
              >
                <Globe className={`w-3.5 h-3.5 ${isBilingualSop ? 'animate-spin' : ''}`} />
                <span>{isBilingualSop ? 'Menerjemahkan...' : 'Bilingual (EN + ID)'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetSop}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap cursor-pointer"
                title="Muat Ulang Template Standar Trafindo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Template Trafindo</span>
              </button>
            </div>
          </div>

          {/* Card Seksi 1: Document Overview */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Document Overview / Gambaran Umum Dokumen
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Dokumen (Document Title)
                </label>
                <input
                  type="text"
                  value={sopData.documentTitle}
                  onChange={(e) => setSopData({ ...sopData, documentTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Contoh: SOP PEMELIHARAAN TRANSFORMATOR (TRAFO)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purpose / Tujuan (English)
                </label>
                <textarea
                  rows={2}
                  value={sopData.documentPurposeEn}
                  onChange={(e) => setSopData({ ...sopData, documentPurposeEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Guide to carry Transformer Maintenance"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tujuan (Bahasa Indonesia)
                </label>
                <textarea
                  rows={2}
                  value={sopData.documentPurposeId}
                  onChange={(e) => setSopData({ ...sopData, documentPurposeId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Panduan pelaksanaan Pemeliharaan Transformator"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Location / Lokasi Kerja (English)
                </label>
                <input
                  type="text"
                  value={sopData.workLocationEn}
                  onChange={(e) => setSopData({ ...sopData, workLocationEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Neutra DC Cikarang"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Kerja (Bahasa Indonesia)
                </label>
                <input
                  type="text"
                  value={sopData.workLocationId}
                  onChange={(e) => setSopData({ ...sopData, workLocationId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Neutra DC Cikarang"
                />
              </div>
            </div>
          </div>

          {/* Card Seksi 2: Equipment Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  Equipment Information / Informasi Peralatan (CI Table)
                </h2>
              </div>
              <button
                type="button"
                onClick={addEquipmentRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">No</th>
                    <th className="p-2.5 w-20">Class ID</th>
                    <th className="p-2.5 w-28">CI Name</th>
                    <th className="p-2.5 w-36">CI Description</th>
                    <th className="p-2.5 w-28">Capacity</th>
                    <th className="p-2.5 w-28">Serial Number</th>
                    <th className="p-2.5 w-20">MFD</th>
                    <th className="p-2.5 w-28">Product Name</th>
                    <th className="p-2.5 w-36">Model</th>
                    <th className="p-2.5 w-28">Room</th>
                    <th className="p-2.5 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sopData.equipmentList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="p-2 text-center font-bold text-slate-500">{item.no}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.classId}
                          onChange={(e) => updateEquipmentItem(idx, 'classId', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.ciName}
                          onChange={(e) => updateEquipmentItem(idx, 'ciName', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.ciDescription}
                          onChange={(e) => updateEquipmentItem(idx, 'ciDescription', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.capacity}
                          onChange={(e) => updateEquipmentItem(idx, 'capacity', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.serialNumber}
                          onChange={(e) => updateEquipmentItem(idx, 'serialNumber', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.mfd}
                          onChange={(e) => updateEquipmentItem(idx, 'mfd', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateEquipmentItem(idx, 'productName', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.model}
                          onChange={(e) => updateEquipmentItem(idx, 'model', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.room}
                          onChange={(e) => updateEquipmentItem(idx, 'room', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeEquipmentRow(idx)}
                          disabled={sopData.equipmentList.length <= 1}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Seksi 3: Schedule / Work Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Schedule / Work Information (Jadwal & Personel)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Execution Date / Tanggal
                </label>
                <input
                  type="text"
                  value={sopData.executionDate}
                  onChange={(e) => setSopData({ ...sopData, executionDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="24 Januari 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference Ticket Number
                </label>
                <input
                  type="text"
                  value={sopData.referenceTicketNumber}
                  onChange={(e) => setSopData({ ...sopData, referenceTicketNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ticket / PTW Number"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Executed By Name / Nama Pelaksana
                </label>
                <input
                  type="text"
                  value={sopData.executedByName}
                  onChange={(e) => setSopData({ ...sopData, executedByName: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Habib Mulyana"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Title / Jabatan
                </label>
                <input
                  type="text"
                  value={sopData.executedByJobTitle}
                  onChange={(e) => setSopData({ ...sopData, executedByJobTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Chief Engineering"
                />
              </div>
            </div>
          </div>

          {/* Card Seksi 4: Affected Equipment / Systems */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Affected Equipment / Systems (Sistem Terdampak)
              </h2>
            </div>

            <p className="text-xs text-slate-500">
              Centang sistem atau peralatan yang terdampak oleh pelaksanaan SOP ini:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {sopData.affectedSystems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleAffectedSystem(item.key)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    item.checked
                      ? 'bg-red-50/80 border-red-300 text-red-950 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="mt-0.5 text-red-600">
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 text-red-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs">
                    <div>{item.labelEn}</div>
                    <div className="text-[11px] text-slate-500 font-normal">{item.labelId}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Affected Systems Details / Catatan Rincian Dampak
              </label>
              <textarea
                rows={2}
                value={sopData.affectedSystemsDetails}
                onChange={(e) => setSopData({ ...sopData, affectedSystemsDetails: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Rincian dampak sistem apabila ada..."
              />
            </div>
          </div>

          {/* Card Seksi 5: Referenced Documents */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  Referenced Documents / Attachments (Dokumen Referensi)
                </h2>
              </div>
              <button
                type="button"
                onClick={addReferencedDoc}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Dokumen</span>
              </button>
            </div>

            <div className="space-y-2">
              {sopData.referencedDocuments.map((docItem, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    value={docItem.name}
                    onChange={(e) => updateReferencedDoc(idx, 'name', e.target.value)}
                    placeholder="Nama Dokumen (Contoh: Form Check Trafo)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                  <input
                    type="text"
                    value={docItem.number}
                    onChange={(e) => updateReferencedDoc(idx, 'number', e.target.value)}
                    placeholder="Nomor Dokumen (Contoh: FORM-TR-01)"
                    className="w-48 sm:w-64 px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferencedDoc(idx)}
                    className="p-2 text-slate-400 hover:text-red-600"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {sopData.referencedDocuments.length === 0 && (
                <p className="text-xs text-slate-400 italic">Belum ada dokumen referensi.</p>
              )}
            </div>
          </div>

          {/* Card Seksi 6: EHS Requirements */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                6
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Environmental, Health & Safety (EHS) Requirements
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">1. APD / PPE:</span>
                <textarea
                  rows={2}
                  value={sopData.ehsRequirements.ppeId}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      ehsRequirements: { ...sopData.ehsRequirements, ppeId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                  placeholder="Helm pengaman, kacamata pengaman, sarung tangan listrik..."
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">2. Larangan Perhiasan Logam:</span>
                <textarea
                  rows={2}
                  value={sopData.ehsRequirements.jewelryId}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      ehsRequirements: { ...sopData.ehsRequirements, jewelryId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                  placeholder="Semua perhiasan logam tidak boleh dipakai saat bekerja..."
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">3. Komunikasi & HT:</span>
                <textarea
                  rows={2}
                  value={sopData.ehsRequirements.commsId}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      ehsRequirements: { ...sopData.ehsRequirements, commsId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                  placeholder="Pastikan komunikasi radio (HT) siap dan jelas..."
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">4. LOTO (Lockout / Tagout):</span>
                <textarea
                  rows={2}
                  value={sopData.ehsRequirements.lotoId}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      ehsRequirements: { ...sopData.ehsRequirements, lotoId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                  placeholder="LOTO harus dipasang di breaker terkait..."
                />
              </div>
            </div>
          </div>

          {/* Card Seksi 7: Prerequisites */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                7
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Prerequisites / Prasyarat Kerja
              </h2>
            </div>

            <div className="space-y-3">
              {sopData.prerequisites.map((prereq, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-slate-800">{prereq.requirementEn}</div>
                    <div className="text-slate-500 font-normal mt-0.5">{prereq.requirementId}</div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <input
                      type="text"
                      placeholder="Time (09:00)"
                      value={prereq.time}
                      onChange={(e) => updatePrerequisiteItem(idx, 'time', e.target.value)}
                      className="w-24 px-2 py-1 text-xs rounded border border-slate-300"
                    />
                    <input
                      type="text"
                      placeholder="Initial"
                      value={prereq.initial}
                      onChange={(e) => updatePrerequisiteItem(idx, 'initial', e.target.value)}
                      className="w-20 px-2 py-1 text-xs rounded border border-slate-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Seksi 8: Dry Run */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                8
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Dry Run (Simulasi Pelaksanaan)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Completed By (Job Title)
                </label>
                <input
                  type="text"
                  value={sopData.dryRun.jobTitle}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      dryRun: { ...sopData.dryRun, jobTitle: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                  placeholder="Chief Engineering"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name / Nama Pelaksana Dry Run
                </label>
                <input
                  type="text"
                  value={sopData.dryRun.name}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      dryRun: { ...sopData.dryRun, name: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                  placeholder="Habib Mulyana"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date / Tanggal Dry Run
                </label>
                <input
                  type="text"
                  value={sopData.dryRun.date}
                  onChange={(e) =>
                    setSopData({
                      ...sopData,
                      dryRun: { ...sopData.dryRun, date: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                  placeholder="24 Januari 2026"
                />
              </div>
            </div>
          </div>

          {/* Card Seksi 9: Maintenance Period */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                9
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Maintenance Period / Periode Pemeliharaan
              </h2>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="maintPeriod"
                  checked={sopData.maintenancePeriod === '6_months'}
                  onChange={() => setSopData({ ...sopData, maintenancePeriod: '6_months' })}
                  className="text-red-600 focus:ring-red-500"
                />
                <span>6 Months (6 Bulanan)</span>
              </label>

              <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="maintPeriod"
                  checked={sopData.maintenancePeriod === 'annual'}
                  onChange={() => setSopData({ ...sopData, maintenancePeriod: 'annual' })}
                  className="text-red-600 focus:ring-red-500"
                />
                <span>Annual (Tahunan)</span>
              </label>
            </div>
          </div>

          {/* Card Seksi 10: Work Instruction / Procedures (Langkah Kerja) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                  10
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  Work Instruction / Procedures (Instruksi & Prosedur Kerja)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => addSopWorkStep()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Langkah</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conditions Prior to Execution (English)
                </label>
                <textarea
                  rows={2}
                  value={sopData.conditionsPriorToExecutionEn}
                  onChange={(e) => setSopData({ ...sopData, conditionsPriorToExecutionEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kondisi Sebelum Eksekusi (Bahasa Indonesia)
                </label>
                <textarea
                  rows={2}
                  value={sopData.conditionsPriorToExecutionId}
                  onChange={(e) => setSopData({ ...sopData, conditionsPriorToExecutionId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-3">
              {sopData.workSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs px-2.5 py-0.5 rounded bg-red-600 text-white">
                      Langkah #{step.no}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveSopWorkStep(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Geser ke Atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSopWorkStep(idx, 'down')}
                        disabled={idx === sopData.workSteps.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Geser ke Bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addSopWorkStep(idx)}
                        className="p-1 text-slate-400 hover:text-emerald-600"
                        title="Sisipkan Langkah di Bawah Ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSopWorkStep(idx)}
                        disabled={sopData.workSteps.length <= 1}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20"
                        title="Hapus Langkah"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Action / Tindakan (English)
                      </label>
                      <textarea
                        rows={2}
                        value={step.actionEn}
                        onChange={(e) => updateSopWorkStep(idx, 'actionEn', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                        placeholder="Action in English..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Action / Tindakan (Bahasa Indonesia)
                      </label>
                      <textarea
                        rows={2}
                        value={step.actionId}
                        onChange={(e) => updateSopWorkStep(idx, 'actionId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-medium text-slate-800"
                        placeholder="Tindakan dalam Bahasa Indonesia..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Expected Outcome (English)
                      </label>
                      <textarea
                        rows={2}
                        value={step.expectedOutcomeEn}
                        onChange={(e) => updateSopWorkStep(idx, 'expectedOutcomeEn', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                        placeholder="Expected outcome in English..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Hasil yang Diharapkan (Bahasa Indonesia)
                      </label>
                      <textarea
                        rows={2}
                        value={step.expectedOutcomeId}
                        onChange={(e) => updateSopWorkStep(idx, 'expectedOutcomeId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                        placeholder="Hasil yang diharapkan dalam Bahasa Indonesia..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500">Waktu (Time):</span>
                      <input
                        type="text"
                        placeholder="09:00"
                        value={step.time}
                        onChange={(e) => updateSopWorkStep(idx, 'time', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500">Paraf (Initial):</span>
                      <input
                        type="text"
                        placeholder="HM"
                        value={step.initial}
                        onChange={(e) => updateSopWorkStep(idx, 'initial', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Seksi 11: Back Out Procedures */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                11
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Back Out Procedures / Prosedur Pembatalan & Rollback
              </h2>
            </div>

            <textarea
              rows={2}
              value={sopData.backOutProcedure}
              onChange={(e) => setSopData({ ...sopData, backOutProcedure: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
              placeholder="Contoh: N/A atau rincian langkah pembatalan..."
            />
          </div>

          {/* Card Seksi 12: Document Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                12
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Document Information / Informasi Dokumen & Revisi
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Penyusun</label>
                <input
                  type="text"
                  value={sopData.author}
                  onChange={(e) => setSopData({ ...sopData, author: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Creation</label>
                <input
                  type="text"
                  value={sopData.dateOfCreation}
                  onChange={(e) => setSopData({ ...sopData, dateOfCreation: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Revision</label>
                <input
                  type="text"
                  value={sopData.dateRevision}
                  onChange={(e) => setSopData({ ...sopData, dateRevision: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revision Number</label>
                <input
                  type="text"
                  value={sopData.revisionNumber}
                  onChange={(e) => setSopData({ ...sopData, revisionNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Card Seksi 13: Approval */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                13
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Approval / Pengesahan Dokumen (4 Approvers)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {sopData.approvals.map((app, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    {app.roleEn}
                    <div className="text-[11px] text-slate-500 font-normal">{app.roleId}</div>
                  </div>
                  <input
                    type="text"
                    placeholder="Nama Penandatangan"
                    value={app.name}
                    onChange={(e) => updateSopApproval(idx, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Tanggal TTD"
                    value={app.date || ''}
                    onChange={(e) => updateSopApproval(idx, 'date', e.target.value)}
                    className="w-full px-2.5 py-1 text-[11px] rounded border border-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Card Seksi 14: Additional Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                14
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Additional Information / Catatan Tambahan
              </h2>
            </div>

            <textarea
              rows={3}
              value={sopData.additionalInformation}
              onChange={(e) => setSopData({ ...sopData, additionalInformation: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
              placeholder="Catatan tambahan, instruksi khusus atau lampiran..."
            />
          </div>

          {/* ─── BOTTOM ACTION BAR (PALING BAWAH DI KANAN) ─── */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Pastikan seluruh data SOP telah terisi lengkap sebelum menyimpan ke Cloud atau mengekspor.</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleSaveSop}
                disabled={isSavingSop}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-black border border-slate-800 shadow-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSop ? 'Menyimpan...' : 'Simpan Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportSop}
                disabled={isExportingSop}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md shadow-red-600/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingSop ? 'Mengekspor Word...' : 'Ekspor Word (.docx)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 2. SUB-TAB: FORMULIR EOP (8 SEKSI)                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'eop' && (
        <div className="space-y-6">
          {/* Action Bar Sticky / Top */}
          <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-3 py-1 rounded-xl bg-fuchsia-600 text-white font-black text-xs uppercase tracking-wider shadow-xs shrink-0">
                EOP Editor
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                  {eopData.documentTitle || 'Form EOP Baru'}
                </span>
                {currentEopDocId && (
                  <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-semibold inline-block mt-0.5">
                    Tersimpan di Cloud • ID: {currentEopDocId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Unggah berkas Word (.docx) SOP/EOP untuk membaca isi berkas dan mengisi form secara otomatis"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
                <span>{isImporting ? 'Membaca...' : 'Import Word (.docx)'}</span>
              </button>

              <button
                type="button"
                onClick={handleBilingualEop}
                disabled={isBilingualEop}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-sm shadow-teal-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Otomatis terjemahkan & selaraskan Bahasa Inggris dan Bahasa Indonesia pada dokumen EOP"
              >
                <Globe className={`w-3.5 h-3.5 ${isBilingualEop ? 'animate-spin' : ''}`} />
                <span>{isBilingualEop ? 'Menerjemahkan...' : 'Bilingual (EN + ID)'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetEop}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap cursor-pointer"
                title="Muat Ulang Template Standar Trafindo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Template Trafindo</span>
              </button>
            </div>
          </div>

          {/* EOP Seksi 1: Document Overview */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Document Overview / Gambaran Umum Dokumen EOP
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Dokumen (Document Title)
                </label>
                <input
                  type="text"
                  value={eopData.documentTitle}
                  onChange={(e) => setEopData({ ...eopData, documentTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  placeholder="Contoh: EOP GANGGUAN OPERASIONAL TRANSFORMATOR"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purpose / Tujuan (English)
                </label>
                <textarea
                  rows={2}
                  value={eopData.documentPurposeEn}
                  onChange={(e) => setEopData({ ...eopData, documentPurposeEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tujuan (Bahasa Indonesia)
                </label>
                <textarea
                  rows={2}
                  value={eopData.documentPurposeId}
                  onChange={(e) => setEopData({ ...eopData, documentPurposeId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Location / Lokasi Kerja (English)
                </label>
                <input
                  type="text"
                  value={eopData.workLocationEn}
                  onChange={(e) => setEopData({ ...eopData, workLocationEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Kerja (Bahasa Indonesia)
                </label>
                <input
                  type="text"
                  value={eopData.workLocationId}
                  onChange={(e) => setEopData({ ...eopData, workLocationId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* EOP Seksi 2: Referenced Documents */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  Referenced Documents / Attachments (Dokumen Referensi EOP)
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEopData((prev) => ({
                    ...prev,
                    referencedDocuments: [...prev.referencedDocuments, { name: '', number: '' }]
                  }))
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Dokumen</span>
              </button>
            </div>

            <div className="space-y-2">
              {eopData.referencedDocuments.map((docItem, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    value={docItem.name}
                    onChange={(e) => {
                      const updated = [...eopData.referencedDocuments];
                      updated[idx].name = e.target.value;
                      setEopData({ ...eopData, referencedDocuments: updated });
                    }}
                    placeholder="Nama Dokumen"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                  <input
                    type="text"
                    value={docItem.number}
                    onChange={(e) => {
                      const updated = [...eopData.referencedDocuments];
                      updated[idx].number = e.target.value;
                      setEopData({ ...eopData, referencedDocuments: updated });
                    }}
                    placeholder="Nomor Dokumen"
                    className="w-48 sm:w-64 px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = eopData.referencedDocuments.filter((_, i) => i !== idx);
                      setEopData({ ...eopData, referencedDocuments: updated });
                    }}
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* EOP Seksi 3: EHS Requirements */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Environmental, Health & Safety (EHS)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">1. APD / PPE:</span>
                <textarea
                  rows={2}
                  value={eopData.ehsRequirements.ppeId}
                  onChange={(e) =>
                    setEopData({
                      ...eopData,
                      ehsRequirements: { ...eopData.ehsRequirements, ppeId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">2. Komunikasi & HT:</span>
                <textarea
                  rows={2}
                  value={eopData.ehsRequirements.commsId}
                  onChange={(e) =>
                    setEopData({
                      ...eopData,
                      ehsRequirements: { ...eopData.ehsRequirements, commsId: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* EOP Seksi 4: Work Instruction (Langkah Tanggap Darurat) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  Work Instruction / Procedure (Langkah Tanggap Darurat EOP)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => addEopWorkStep()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Langkah</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Conditions (English)
                </label>
                <textarea
                  rows={2}
                  value={eopData.expectedConditionsEn}
                  onChange={(e) => setEopData({ ...eopData, expectedConditionsEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kondisi yang Diharapkan (Bahasa Indonesia)
                </label>
                <textarea
                  rows={2}
                  value={eopData.expectedConditionsId}
                  onChange={(e) => setEopData({ ...eopData, expectedConditionsId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-3">
              {eopData.workSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs px-2.5 py-0.5 rounded bg-fuchsia-600 text-white">
                      Langkah #{step.no}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveEopWorkStep(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveEopWorkStep(idx, 'down')}
                        disabled={idx === eopData.workSteps.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addEopWorkStep(idx)}
                        className="p-1 text-slate-400 hover:text-emerald-600"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEopWorkStep(idx)}
                        disabled={eopData.workSteps.length <= 1}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Action (English)
                      </label>
                      <textarea
                        rows={2}
                        value={step.actionEn}
                        onChange={(e) => updateEopWorkStep(idx, 'actionEn', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Tindakan (Bahasa Indonesia)
                      </label>
                      <textarea
                        rows={2}
                        value={step.actionId}
                        onChange={(e) => updateEopWorkStep(idx, 'actionId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-medium text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Expected Outcome (English)
                      </label>
                      <textarea
                        rows={2}
                        value={step.expectedOutcomeEn}
                        onChange={(e) => updateEopWorkStep(idx, 'expectedOutcomeEn', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Hasil yang Diharapkan (Bahasa Indonesia)
                      </label>
                      <textarea
                        rows={2}
                        value={step.expectedOutcomeId}
                        onChange={(e) => updateEopWorkStep(idx, 'expectedOutcomeId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500">Waktu (Time):</span>
                      <input
                        type="text"
                        placeholder="14:00"
                        value={step.time}
                        onChange={(e) => updateEopWorkStep(idx, 'time', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500">Nama Pelaksana:</span>
                      <input
                        type="text"
                        placeholder="Nama"
                        value={step.name}
                        onChange={(e) => updateEopWorkStep(idx, 'name', e.target.value)}
                        className="w-36 px-2 py-1 text-xs border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* EOP Seksi 5: Document Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                5
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Document Information (Informasi Dokumen EOP)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Penyusun</label>
                <input
                  type="text"
                  value={eopData.author}
                  onChange={(e) => setEopData({ ...eopData, author: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Creation</label>
                <input
                  type="text"
                  value={eopData.dateOfCreation}
                  onChange={(e) => setEopData({ ...eopData, dateOfCreation: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Next Date Revision</label>
                <input
                  type="text"
                  value={eopData.nextDateRevision}
                  onChange={(e) => setEopData({ ...eopData, nextDateRevision: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revision Number</label>
                <input
                  type="text"
                  value={eopData.revisionNumber}
                  onChange={(e) => setEopData({ ...eopData, revisionNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* EOP Seksi 6: Dry Run */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                6
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Dry Run (Simulasi Pelaksanaan EOP)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={eopData.dryRun.jobTitle}
                  onChange={(e) =>
                    setEopData({ ...eopData, dryRun: { ...eopData.dryRun, jobTitle: e.target.value } })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={eopData.dryRun.name}
                  onChange={(e) =>
                    setEopData({ ...eopData, dryRun: { ...eopData.dryRun, name: e.target.value } })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="text"
                  value={eopData.dryRun.date}
                  onChange={(e) =>
                    setEopData({ ...eopData, dryRun: { ...eopData.dryRun, date: e.target.value } })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* EOP Seksi 7: Approval */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                7
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Approval / Pengesahan Dokumen EOP
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {eopData.approvals.map((app, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    {app.roleEn}
                    <div className="text-[11px] text-slate-500 font-normal">{app.roleId}</div>
                  </div>
                  <input
                    type="text"
                    placeholder="Nama"
                    value={app.name}
                    onChange={(e) => updateEopApproval(idx, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Tanggal"
                    value={app.date || ''}
                    onChange={(e) => updateEopApproval(idx, 'date', e.target.value)}
                    className="w-full px-2.5 py-1 text-[11px] rounded border border-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* EOP Seksi 8: Additional Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold text-xs flex items-center justify-center">
                8
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Additional Information / Catatan Tambahan EOP
              </h2>
            </div>

            <textarea
              rows={3}
              value={eopData.additionalInformation}
              onChange={(e) => setEopData({ ...eopData, additionalInformation: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
            />
          </div>

          {/* ─── BOTTOM ACTION BAR (PALING BAWAH DI KANAN) ─── */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-fuchsia-500 shrink-0" />
              <span>Pastikan seluruh data EOP telah terisi lengkap sebelum menyimpan ke Cloud atau mengekspor.</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleSaveEop}
                disabled={isSavingEop}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-black border border-slate-800 shadow-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingEop ? 'Menyimpan...' : 'Simpan Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportEop}
                disabled={isExportingEop}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 shadow-md shadow-fuchsia-600/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingEop ? 'Mengekspor Word...' : 'Ekspor Word (.docx)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB: ARSIP DOKUMEN SOP & EOP                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'archive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Cari arsip SOP / EOP..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setArchiveFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    archiveFilterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveFilterType('SOP')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    archiveFilterType === 'SOP' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  SOP
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveFilterType('EOP')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    archiveFilterType === 'EOP' ? 'bg-fuchsia-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  EOP
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Unggah berkas Word (.docx) untuk membaca isi berkas dan mengisi form secara otomatis"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
                <span>{isImporting ? 'Membaca...' : 'Import Word (.docx)'}</span>
              </button>

              <button
                type="button"
                onClick={fetchArchive}
                disabled={isLoadingArchive}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoadingArchive ? 'animate-spin' : ''}`} />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>

          {/* List Dokumen Tersimpan */}
          {isLoadingArchive ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-sm">Memuat daftar arsip SOP & EOP dari Cloud...</p>
            </div>
          ) : filteredArchive.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FolderOpen className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Belum Ada Dokumen di Arsip</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Silakan buat SOP atau EOP baru pada form di atas, lalu klik tombol "Simpan Arsip Cloud" untuk menyimpannya ke arsip ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredArchive.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          item.type === 'SOP'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.workLocationEn || 'Neutra DC Cikarang'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                      {item.documentTitle || 'Dokumen Tanpa Judul'}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {item.documentPurposeId || item.documentPurposeEn || '-'}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100">
                      <span>Penyusun: <strong className="text-slate-700">{item.author || '-'}</strong></span>
                      <span>Revisi: <strong className="text-slate-700">{item.revisionNumber || '00'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadArchiveDoc(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Buka Form</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadArchiveDoc(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition-all"
                        title="Download Dokumen Word (.docx)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Word (.docx)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteArchiveDoc(item.id, item.documentTitle || 'Dokumen')}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
