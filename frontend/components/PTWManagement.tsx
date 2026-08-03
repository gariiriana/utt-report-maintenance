import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clipboard as ClipboardIcon, Plus, Search, Trash2, Edit2,
  X, CheckCircle2, Loader2, Calendar, Hash, Package,
  AlertCircle, Download, FileUp, File, ChevronDown, Eye
} from 'lucide-react';
import { parsePTWPdf, parsePTWFromFilename } from '@/utils/ptwPdfParser';
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, query, orderBy, serverTimestamp, Timestamp, getDocs, writeBatch, deleteField
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { sendFileNotification } from '@/utils/notificationService';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { safeHtml2Canvas } from '@/utils/ReportPdfExport';
import { 
  exportPTWListToExcel, 
  exportPTWListToPDF, 
  exportPTWWeeklyReportToExcel, 
  exportPTWWeeklyReportToPDF 
} from '@/utils/ptwExport';

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
  closingFileName?: string;
  closingTotalChunks?: number;
  createdBy: string;
  createdAt: Timestamp;
}
const EQUIPMENT_CODE_MAP: Record<string, string> = {
  'WT': 'WATER TREATMENT',
  'WL': 'WATER LEAK DETECTOR',
  'FLD': 'FUEL LEAK DETECTOR',
  'LP': 'LIGHTING POINT',
  'CT': 'COOLING TOWER',
  'DL': 'DOCK LEVELLER'
};

export const normalizeEquipmentCode = (rawCode: string): string => {
  if (!rawCode) return 'LAINNYA';
  let code = rawCode.toUpperCase().trim();
  while (/^(PTW|PM|TDE|HSE)([\s\-_/]+|$)/i.test(code)) {
    code = code.replace(/^(PTW|PM|TDE|HSE)([\s\-_/]+|$)/i, '').trim();
  }
  code = code.toUpperCase() || 'LAINNYA';
  return EQUIPMENT_CODE_MAP[code] || code;
};


interface QueuedPTWItem {
  id: string;
  file: File | null;
  sequenceNumber: string;
  equipmentCode: string;
  quarter: string;
  startDate: string;
  endDate: string;
  notes: string;
  isScanning: boolean;
  scanStatus: string;
  scanSource: 'filename' | 'ocr' | 'none';
  isExpanded: boolean;
}

interface PTWManagementProps {
  initialSearchQuery?: string;
}

export function PTWManagement({ initialSearchQuery }: PTWManagementProps = {}) {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'weekly'>('list');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [records, setRecords] = useState<PTWRecord[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ name: string; records: PTWRecord[] } | null>(null);
  const [shouldDeleteFile, setShouldDeleteFile] = useState(false);

  const toggleGroup = (code: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };


  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchQuery || '');

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchTerm(initialSearchQuery);
    }
  }, [initialSearchQuery]);
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
  const [selectedClosingFile, setSelectedClosingFile] = useState<File | null>(null);
  const [shouldDeleteClosingFile, setShouldDeleteClosingFile] = useState(false);
  const [queuedItems, setQueuedItems] = useState<QueuedPTWItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmResolver, setConfirmResolver] = useState<{ resolve: (val: boolean) => void } | null>(null);

  const askConfirmation = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModalMessage(message);
      setConfirmResolver({ resolve });
      setConfirmModalOpen(true);
    });
  };

  const handleConfirmResponse = (value: boolean) => {
    if (confirmResolver) {
      confirmResolver.resolve(value);
    }
    setConfirmModalOpen(false);
    setConfirmResolver(null);
  };

  const toggleQueueItemExpanded = (id: string) => {
    setQueuedItems(prev => prev.map(item => 
      item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
    ));
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQueueItemField = (id: string, field: keyof QueuedPTWItem, value: any) => {
    setQueuedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === 'startDate' && value) {
        try {
          const month = parseInt(value.split('-')[1]);
          if (month <= 3) updated.quarter = '1';
          else if (month <= 6) updated.quarter = '2';
          else if (month <= 9) updated.quarter = '3';
          else updated.quarter = '4';
        } catch (e) {}
      }
      
      return updated;
    }));
  };

  const handleAddManualQueueItem = () => {
    const itemId = Math.random().toString(36).substring(2, 9);
    const newItem: QueuedPTWItem = {
      id: itemId,
      file: null,
      sequenceNumber: '',
      equipmentCode: '',
      quarter: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      notes: '',
      isScanning: false,
      scanStatus: '',
      scanSource: 'none',
      isExpanded: true
    };
    setQueuedItems(prev => [...prev, newItem]);
  };

  const runOcrOnItem = async (itemId: string, file: File) => {
    setQueuedItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, isScanning: true, scanStatus: 'Memulai pemindaian...' }
        : item
    ));
    
    try {
      const extracted = await parsePTWPdf(file, (msg) => {
        setQueuedItems(prev => prev.map(item => 
          item.id === itemId 
            ? { ...item, scanStatus: msg }
            : item
        ));
      });
      
      setQueuedItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        
        const updated = { ...item };
        updated.scanSource = 'ocr';
        
        if (extracted.sequenceNumber) {
          updated.sequenceNumber = extracted.sequenceNumber;
        }
        if (extracted.equipmentCode && (!item.equipmentCode || item.equipmentCode.toUpperCase() === 'PTW')) {
          updated.equipmentCode = extracted.equipmentCode;
        }
        if (extracted.quarter) {
          updated.quarter = extracted.quarter;
        }
        if (extracted.startDate) {
          updated.startDate = extracted.startDate;
        }
        if (extracted.endDate) {
          updated.endDate = extracted.endDate;
        }
        if (extracted.maintenanceName) {
          updated.notes = extracted.maintenanceName;
        }
        
        return updated;
      }));
      
      toast.success(`✅ Pemindaian selesai: ${file.name}`);
    } catch (err) {
      console.error('PDF scan error for item', itemId, err);
      toast.error(`⚠️ Gagal memindai isi PDF ${file.name} secara mendalam.`);
    } finally {
      setQueuedItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, isScanning: false, scanStatus: '' }
          : item
      ));
    }
  };

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

  const processUploadedFiles = async (files: FileList | File[]) => {
    const newItems: QueuedPTWItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        toast.error(`File ${file.name} bukan file PDF.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} terlalu besar. Maksimal 10MB.`);
        continue;
      }

      // Check if file is already uploaded
      const isDuplicate = records.some(r => r.fileName === file.name || r.closingFileName === file.name);
      if (isDuplicate) {
        const confirmUpload = await askConfirmation(`File "${file.name}" sudah pernah di-upload sebelumnya. Apakah Anda yakin ingin tetap mengunggahnya?`);
        if (!confirmUpload) {
          continue;
        }
      }
      
      const itemId = Math.random().toString(36).substring(2, 9);
      const filenameData = parsePTWFromFilename(file.name);
      
      const item: QueuedPTWItem = {
        id: itemId,
        file: file,
        sequenceNumber: filenameData.sequenceNumber || '',
        equipmentCode: filenameData.equipmentCode || '',
        quarter: filenameData.quarter || '',
        startDate: filenameData.startDate || new Date().toISOString().split('T')[0],
        endDate: filenameData.endDate || new Date().toISOString().split('T')[0],
        notes: filenameData.maintenanceName || '',
        isScanning: false,
        scanStatus: '',
        scanSource: filenameData.sequenceNumber ? 'filename' : 'none',
        isExpanded: false
      };
      
      newItems.push(item);
    }
    
    if (newItems.length === 0) return;
    
    setQueuedItems(prev => [...prev, ...newItems]);
    
    newItems.forEach(item => {
      if (!item.sequenceNumber && item.file) {
        runOcrOnItem(item.id, item.file);
      } else if (item.sequenceNumber) {
        toast.success(`⚡ Semua data berhasil diisi instan dari nama file: ${item.file?.name}`);
      }
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isEditModalOpen) {
      const file = files[0];
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File terlalu besar. Maksimal 10MB.');
        e.target.value = '';
        return;
      }

      // Check if file is already uploaded
      const isDuplicate = records.some(r => r.fileName === file.name || r.closingFileName === file.name);
      if (isDuplicate) {
        const confirmUpload = await askConfirmation(`File "${file.name}" sudah pernah di-upload sebelumnya. Apakah Anda yakin ingin tetap mengunggahnya?`);
        if (!confirmUpload) {
          e.target.value = '';
          return;
        }
      }

      setSelectedFile(file);

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const filenameData = parsePTWFromFilename(file.name);
        const initialFields: string[] = [];
        
        setFormData(prev => {
          const updated = { ...prev };
          if (filenameData.sequenceNumber) {
            updated.sequenceNumber = filenameData.sequenceNumber;
            initialFields.push('No. Urut');
          }
          if (filenameData.equipmentCode) {
            updated.equipmentCode = filenameData.equipmentCode;
            initialFields.push('Equipment Code');
          }
          if (filenameData.quarter) {
            updated.quarter = filenameData.quarter;
            initialFields.push('Quarter');
          }
          if (filenameData.startDate) {
            updated.startDate = filenameData.startDate;
            initialFields.push('Tanggal Mulai');
          }
          if (filenameData.endDate) {
            updated.endDate = filenameData.endDate;
            initialFields.push('Tanggal Selesai');
          }
          if (filenameData.maintenanceName) {
            updated.notes = filenameData.maintenanceName;
            initialFields.push('Nama Maintenance');
          }
          return updated;
        });

        if (filenameData.sequenceNumber) {
          toast.success(`⚡ Semua data berhasil diisi instan dari nama file!`, { duration: 4000 });
        } else {
          if (initialFields.length > 0) {
            toast.success(`⚡ Mengisi awal data dari nama file: ${initialFields.join(', ')}`, { duration: 3000 });
          }

          const scanToast = toast.loading('🔍 Memindai isi berkas PDF...');
          try {
            const extracted = await parsePTWPdf(file, (msg) => {
              toast.loading(`🔍 ${msg}`, { id: scanToast });
            });
            const filledFields: string[] = [];

            setFormData(prev => {
              const updated = { ...prev };
              if (extracted.sequenceNumber) {
                updated.sequenceNumber = extracted.sequenceNumber;
                if (!initialFields.includes('No. Urut')) filledFields.push('No. Urut');
              }
              if (extracted.equipmentCode && (!filenameData.equipmentCode || filenameData.equipmentCode.toUpperCase() === 'PTW')) {
                updated.equipmentCode = extracted.equipmentCode;
                if (!initialFields.includes('Equipment Code')) filledFields.push('Equipment Code');
              }
              if (extracted.quarter) {
                updated.quarter = extracted.quarter;
                if (!initialFields.includes('Quarter')) filledFields.push('Quarter');
              }
              if (extracted.startDate) {
                updated.startDate = extracted.startDate;
                if (!initialFields.includes('Tanggal Mulai')) filledFields.push('Tanggal Mulai');
              }
              if (extracted.endDate) {
                updated.endDate = extracted.endDate;
                if (!initialFields.includes('Tanggal Selesai')) filledFields.push('Tanggal Selesai');
              }
              if (extracted.maintenanceName) {
                updated.notes = extracted.maintenanceName;
                if (!initialFields.includes('Nama Maintenance')) filledFields.push('Nama Maintenance');
              }
              return updated;
            });

            const totalFilled = initialFields.length + filledFields.length;
            if (totalFilled > 0) {
              toast.success(
                `✅ Pemindaian selesai! Berhasil mengisi data PTW.`,
                { id: scanToast, duration: 4000 }
              );
            } else {
              toast.warning('⚠️ Tidak dapat mengekstrak data tambahan dari isi berkas.', { id: scanToast, duration: 4000 });
            }
          } catch (err) {
            console.error('PDF scan error:', err);
            toast.error('Gagal memindai isi PDF secara mendalam. Data dari nama file tetap digunakan.', { id: scanToast });
          }
        }
      }
    } else {
      processUploadedFiles(files);
      e.target.value = '';
    }
  };

  const handleDownload = async (record: PTWRecord) => {
    if (!record.fileName || !record.totalChunks) return;
    const toastId = toast.loading('Menyiapkan unduhan...');
    try {
      const chunksSnap = await getDocs(
        collection(db, 'ptw_records', record.id, 'chunks')
      );
      if (chunksSnap.empty) { toast.error('File tidak ditemukan', { id: toastId }); return; }

      // Filter in memory for main chunks and sort by index
      const mainDocs = chunksSnap.docs
        .filter(d => !d.data().isClosing)
        .sort((a, b) => (a.data().index || 0) - (b.data().index || 0));

      if (mainDocs.length === 0) { toast.error('File tidak ditemukan', { id: toastId }); return; }

      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';
      mainDocs.forEach((d) => {
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

  const handleDownloadClosing = async (record: PTWRecord) => {
    if (!record.closingFileName || !record.closingTotalChunks) return;
    const toastId = toast.loading('Menyiapkan unduhan file closing...');
    try {
      const chunksSnap = await getDocs(
        collection(db, 'ptw_records', record.id, 'chunks')
      );
      if (chunksSnap.empty) { toast.error('File closing tidak ditemukan', { id: toastId }); return; }

      // Filter in memory for closing chunks and sort by index
      const closingDocs = chunksSnap.docs
        .filter(d => d.data().isClosing === true)
        .sort((a, b) => (a.data().index || 0) - (b.data().index || 0));

      if (closingDocs.length === 0) { toast.error('File closing tidak ditemukan', { id: toastId }); return; }

      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';
      closingDocs.forEach((d) => {
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
      link.download = record.closingFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('File closing berhasil diunduh!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh file closing', { id: toastId });
    }
  };

  const handlePreview = async (record: PTWRecord) => {
    if (!record.fileName || !record.totalChunks) return;
    const toastId = toast.loading('Menyiapkan pratinjau...');
    try {
      const chunksSnap = await getDocs(
        collection(db, 'ptw_records', record.id, 'chunks')
      );
      if (chunksSnap.empty) { toast.error('File tidak ditemukan', { id: toastId }); return; }

      // Filter in memory for main chunks and sort by index
      const mainDocs = chunksSnap.docs
        .filter(d => !d.data().isClosing)
        .sort((a, b) => (a.data().index || 0) - (b.data().index || 0));

      if (mainDocs.length === 0) { toast.error('File tidak ditemukan', { id: toastId }); return; }

      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';
      mainDocs.forEach((d) => {
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
      
      const previewWindow = window.open(url, '_blank');
      if (!previewWindow) {
        toast.error('Gagal membuka pratinjau. Silakan periksa blocker pop-up Anda.', { id: toastId });
        return;
      }
      
      toast.success('Pratinjau berhasil dibuka!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat pratinjau', { id: toastId });
    }
  };

  const handlePreviewClosing = async (record: PTWRecord) => {
    if (!record.closingFileName || !record.closingTotalChunks) return;
    const toastId = toast.loading('Menyiapkan pratinjau file closing...');
    try {
      const chunksSnap = await getDocs(
        collection(db, 'ptw_records', record.id, 'chunks')
      );
      if (chunksSnap.empty) { toast.error('File closing tidak ditemukan', { id: toastId }); return; }

      // Filter in memory for closing chunks and sort by index
      const closingDocs = chunksSnap.docs
        .filter(d => d.data().isClosing === true)
        .sort((a, b) => (a.data().index || 0) - (b.data().index || 0));

      if (closingDocs.length === 0) { toast.error('File closing tidak ditemukan', { id: toastId }); return; }

      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';
      closingDocs.forEach((d) => {
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
      
      const previewWindow = window.open(url, '_blank');
      if (!previewWindow) {
        toast.error('Gagal membuka pratinjau. Silakan periksa blocker pop-up Anda.', { id: toastId });
        return;
      }
      
      toast.success('Pratinjau file closing berhasil dibuka!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat pratinjau file closing', { id: toastId });
    }
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isAddModalOpen || isEditModalOpen || isDeleteModalOpen || isDeleteCategoryModalOpen || confirmModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAddModalOpen, isEditModalOpen, isDeleteModalOpen, isDeleteCategoryModalOpen, confirmModalOpen]);


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
    if (!user) return;

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
      if (error.code === 'permission-denied') {
        console.warn('PTW subscription cancelled due to logout/insufficient permissions.');
        return;
      }
      console.error('Error loading PTW:', error);
      toast.error('Gagal memuat data PTW');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      if (isEditModalOpen && selectedRecord) {
        // ===== EDIT FLOW =====
        const ptwNum = `TDE/PTW/${formData.sequenceNumber.padStart(4, '0')}`;
        let totalChunks = 0;

        const updateData: Record<string, any> = {
          sequenceNumber: parseInt(formData.sequenceNumber),
          ptwNumber: ptwNum,
          equipmentCode: normalizeEquipmentCode(formData.equipmentCode),
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes,
          updatedAt: serverTimestamp()
        };

        if (selectedFile) {
          totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

          // Delete old main chunks
          if (selectedRecord.totalChunks) {
            const oldChunks = await getDocs(collection(db, 'ptw_records', selectedRecord.id, 'chunks'));
            const delBatch = writeBatch(db);
            oldChunks.docs.forEach(d => {
              if (!d.data().isClosing) {
                delBatch.delete(d.ref);
              }
            });
            await delBatch.commit();
          }

          // Upload new chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            let chunkBase64 = await chunkToBase64(selectedFile.slice(start, end));
            if (i === 0) chunkBase64 = `data:${selectedFile.type};base64,${chunkBase64}`;
            await addDoc(collection(db, 'ptw_records', selectedRecord.id, 'chunks'), { 
              index: i, 
              data: chunkBase64,
              isClosing: false
            });
            setUploadProgress(((i + 1) / totalChunks) * 45);
            await new Promise(r => setTimeout(r, 30));
          }

          updateData.fileName = selectedFile.name;
          updateData.totalChunks = totalChunks;
        } else if (shouldDeleteFile) {
          // Delete old main chunks
          if (selectedRecord.totalChunks) {
            const oldChunks = await getDocs(collection(db, 'ptw_records', selectedRecord.id, 'chunks'));
            const delBatch = writeBatch(db);
            oldChunks.docs.forEach(d => {
              if (!d.data().isClosing) {
                delBatch.delete(d.ref);
              }
            });
            await delBatch.commit();
          }
          // Remove fields from document
          updateData.fileName = deleteField();
          updateData.totalChunks = deleteField();
        }

        // ===== CLOSING PTW UPLOAD / DELETE =====
        let closingTotalChunks = 0;
        if (selectedClosingFile) {
          closingTotalChunks = Math.ceil(selectedClosingFile.size / CHUNK_SIZE);

          // Delete old closing chunks
          if (selectedRecord.closingTotalChunks) {
            const oldChunks = await getDocs(collection(db, 'ptw_records', selectedRecord.id, 'chunks'));
            const delBatch = writeBatch(db);
            oldChunks.docs.forEach(d => {
              if (d.data().isClosing === true) {
                delBatch.delete(d.ref);
              }
            });
            await delBatch.commit();
          }

          // Upload new closing chunks
          for (let i = 0; i < closingTotalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedClosingFile.size);
            let chunkBase64 = await chunkToBase64(selectedClosingFile.slice(start, end));
            if (i === 0) chunkBase64 = `data:${selectedClosingFile.type};base64,${chunkBase64}`;
            await addDoc(collection(db, 'ptw_records', selectedRecord.id, 'chunks'), { 
              index: i, 
              data: chunkBase64,
              isClosing: true
            });
            setUploadProgress(45 + (((i + 1) / closingTotalChunks) * 45));
            await new Promise(r => setTimeout(r, 30));
          }

          updateData.closingFileName = selectedClosingFile.name;
          updateData.closingTotalChunks = closingTotalChunks;
        } else if (shouldDeleteClosingFile) {
          // Delete old closing chunks
          if (selectedRecord.closingTotalChunks) {
            const oldChunks = await getDocs(collection(db, 'ptw_records', selectedRecord.id, 'chunks'));
            const delBatch = writeBatch(db);
            oldChunks.docs.forEach(d => {
              if (d.data().isClosing === true) {
                delBatch.delete(d.ref);
              }
            });
            await delBatch.commit();
          }
          // Remove fields from document
          updateData.closingFileName = deleteField();
          updateData.closingTotalChunks = deleteField();
        }

        await updateDoc(doc(db, 'ptw_records', selectedRecord.id), updateData);
        toast.success('PTW berhasil diperbarui');

      } else {
        // ===== ADD FLOW (MULTI-FILE) =====
        if (queuedItems.length === 0) {
          toast.error('Belum ada file atau data PTW yang ditambahkan.');
          setSubmitting(false);
          return;
        }

        // Validate all queued items have required fields
        const invalidItems = queuedItems.filter(item => 
          !item.sequenceNumber || !item.equipmentCode || !item.quarter || !item.startDate || !item.endDate
        );
        if (invalidItems.length > 0) {
          toast.error('Ada berkas dalam antrean yang datanya belum lengkap. Silakan lengkapi data terlebih dahulu.');
          setSubmitting(false);
          return;
        }

        const totalItems = queuedItems.length;
        
        for (let idx = 0; idx < totalItems; idx++) {
          const item = queuedItems[idx];
          const ptwNum = `TDE/PTW/${item.sequenceNumber.padStart(4, '0')}`;
          let itemChunks = 0;
          
          if (item.file) {
            itemChunks = Math.ceil(item.file.size / CHUNK_SIZE);
          }

          // Show toast status for the current uploading file
          toast.loading(`Mengunggah PTW ${idx + 1} dari ${totalItems}: ${item.file ? item.file.name : 'Data Manual'}...`, { id: 'multi-upload-toast' });
          
          // Create doc first to get ID
          const newDocRef = await addDoc(collection(db, 'ptw_records'), {
            sequenceNumber: parseInt(item.sequenceNumber),
            ptwNumber: ptwNum,
            equipmentCode: normalizeEquipmentCode(item.equipmentCode),
            quarter: item.quarter,
            startDate: item.startDate,
            endDate: item.endDate,
            notes: item.notes,
            ...(item.file && { fileName: item.file.name, totalChunks: itemChunks }),
            createdBy: user.email,
            createdAt: serverTimestamp()
          });

          await sendFileNotification({
            title: `Dokumen PTW Baru: ${ptwNum}`,
            fileName: item.file ? item.file.name : `PTW_${ptwNum}`,
            category: 'PTW',
            fileId: newDocRef.id,
            uploadedBy: user?.email || 'Engineer',
            targetTab: 'ptw',
            searchQuery: ptwNum
          });
          
          // Upload chunks to new doc
          if (item.file) {
            for (let i = 0; i < itemChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, item.file.size);
              let chunkBase64 = await chunkToBase64(item.file.slice(start, end));
              if (i === 0) chunkBase64 = `data:${item.file.type};base64,${chunkBase64}`;
              await addDoc(collection(db, 'ptw_records', newDocRef.id, 'chunks'), { 
                index: i, 
                data: chunkBase64,
                isClosing: false
              });
              
              // Calculate global progress
              const baseProgress = (idx / totalItems) * 100;
              const fileProgress = (((i + 1) / itemChunks) * (100 / totalItems));
              setUploadProgress(baseProgress + fileProgress);
              
              await new Promise(r => setTimeout(r, 20));
            }
          } else {
            // Advancing progress for manual entry without file
            const baseProgress = ((idx + 1) / totalItems) * 100;
            setUploadProgress(baseProgress);
          }
        }
        
        toast.success(`Berhasil menambahkan ${totalItems} data PTW baru!`, { id: 'multi-upload-toast' });
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

  const handleDeleteCategory = (categoryName: string, categoryRecords: PTWRecord[]) => {
    setCategoryToDelete({ name: categoryName, records: categoryRecords });
    setIsDeleteCategoryModalOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      for (const rec of categoryToDelete.records) {
        // Delete chunk subcollections
        const chunksSnap = await getDocs(collection(db, 'ptw_records', rec.id, 'chunks'));
        chunksSnap.docs.forEach(d => batch.delete(d.ref));
        // Delete the main record doc
        batch.delete(doc(db, 'ptw_records', rec.id));
      }
      await batch.commit();
      toast.success(`Seluruh data PTW kategori ${categoryToDelete.name} berhasil dihapus`);
      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    } finally {
      setSubmitting(false);
    }
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
    setShouldDeleteFile(false);
    setSelectedClosingFile(null);
    setShouldDeleteClosingFile(false);
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
    setSelectedClosingFile(null);
    setShouldDeleteFile(false);
    setShouldDeleteClosingFile(false);
    setQueuedItems([]);
  };

  const filteredRecords = records.filter(r =>
    r.ptwNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.equipmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    normalizeEquipmentCode(r.equipmentCode).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const code = normalizeEquipmentCode(record.equipmentCode);

    if (!acc[code]) acc[code] = [];
    acc[code].push(record);
    return acc;
  }, {} as Record<string, PTWRecord[]>);

  useEffect(() => {
    if (searchTerm) {
      const activeGroups = [...new Set(filteredRecords.map(r => 
        normalizeEquipmentCode(r.equipmentCode)
      ))];
      const newExpanded: Record<string, boolean> = {};
      activeGroups.forEach(g => {
        newExpanded[g] = true;
      });
      setExpandedGroups(newExpanded);
    }
  }, [searchTerm, filteredRecords]);

  // Helper to split month dynamically into weeks based on PTW data
  const getDataDrivenWeeks = (year: number, month: number, ptwRecords: PTWRecord[]) => {
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const monthFull = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

    const parseLocal = (dateStr: string) => {
      const parts = dateStr.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    // Filter records belonging to the selected month and year
    const monthRecords = ptwRecords.filter(r => {
      if (!r.startDate) return false;
      const d = parseLocal(r.startDate);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });

    let startWeekDate = new Date(year, month - 1, 1);
    if (monthRecords.length > 0) {
      const startDates = monthRecords.map(r => parseLocal(r.startDate));
      startWeekDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    }

    const weeks: {
      weekNum: number;
      startStr: string;
      endStr: string;
      rangeLabel: string;
      dateRange: string;
      shortRange: string;
      records: PTWRecord[];
      openCount: number;
      closedCount: number;
      totalCount: number;
    }[] = [];

    let blockStart = new Date(startWeekDate);
    let weekNum = 1;
    const todayStr = new Date().toISOString().split('T')[0];

    // We continue generating weeks until blockStart is past the selected month
    while (blockStart.getFullYear() === year && blockStart.getMonth() === month - 1) {
      const blockEnd = new Date(blockStart);
      blockEnd.setDate(blockEnd.getDate() + 6);

      const startStr = formatDate(blockStart);
      const endStr = formatDate(blockEnd);

      // Label formatting
      const minDay = String(blockStart.getDate()).padStart(2, '0');
      const maxDay = String(blockEnd.getDate()).padStart(2, '0');

      let rangeLabel = '';
      let shortRange = '';

      if (blockStart.getMonth() === blockEnd.getMonth()) {
        rangeLabel = `${minDay} - ${maxDay} ${monthFull[blockStart.getMonth()]} ${blockStart.getFullYear()}`;
        shortRange = `${minDay} - ${maxDay}`;
      } else {
        rangeLabel = `${minDay} ${monthFull[blockStart.getMonth()]} - ${maxDay} ${monthFull[blockEnd.getMonth()]} ${blockEnd.getFullYear()}`;
        shortRange = `${minDay} ${monthShort[blockStart.getMonth()]} - ${maxDay} ${monthShort[blockEnd.getMonth()]}`;
      }

      // Filter active records within this week block
      const weekRecords = monthRecords.filter(r => r.startDate >= startStr && r.startDate <= endStr);
      
      const openRecords = weekRecords.filter(r => !r.closingFileName && (!r.endDate || r.endDate >= todayStr));
      const closedRecords = weekRecords.filter(r => !!r.closingFileName || (!!r.endDate && r.endDate < todayStr));

      weeks.push({
        weekNum,
        startStr,
        endStr,
        rangeLabel,
        dateRange: rangeLabel,
        shortRange,
        records: weekRecords,
        openCount: openRecords.length,
        closedCount: closedRecords.length,
        totalCount: weekRecords.length,
      });

      weekNum++;
      blockStart = new Date(blockEnd);
      blockStart.setDate(blockStart.getDate() + 1);
    }

    return weeks;
  };

  const weeklyData = getDataDrivenWeeks(selectedYear, selectedMonth, records);

  useEffect(() => {
    if (selectedWeek > weeklyData.length) {
      setSelectedWeek(1);
    }
  }, [selectedYear, selectedMonth, selectedWeek, weeklyData.length]);

  const chartData = weeklyData.map(wd => ({
    name: `Minggu ${wd.weekNum}`,
    'Open (Aktif)': wd.openCount,
    'Closed (Selesai)': wd.closedCount,
    'Total PTW': wd.totalCount,
  }));

  // Monthly grand totals for the summary cards
  const monthlyTotalPTW = weeklyData.reduce((sum, wd) => sum + wd.totalCount, 0);
  const monthlyTotalOpen = weeklyData.reduce((sum, wd) => sum + wd.openCount, 0);
  const monthlyTotalClosed = weeklyData.reduce((sum, wd) => sum + wd.closedCount, 0);

  const handleExportPdfReport = async () => {
    const toastId = toast.loading('Menyiapkan grafik untuk PDF...');
    try {
      const chartEl = document.getElementById('ptw-weekly-chart-container');
      let chartBase64 = '';
      if (chartEl) {
        const canvas = await safeHtml2Canvas(chartEl, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#0f172a', // Slate-900 matching dashboard dark background
          scale: 2,
          logging: false,
        });
        chartBase64 = canvas.toDataURL('image/png');
      }
      toast.dismiss(toastId);

      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const monthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;

      await exportPTWWeeklyReportToPDF(monthLabel, weeklyData, chartBase64);
    } catch (err) {
      console.error('Pdf export failed:', err);
      toast.error('Gagal mengekspor laporan ke PDF');
      toast.dismiss(toastId);
    }
  };

  const handleExportExcelReport = async () => {
    const toastId = toast.loading('Menyiapkan grafik untuk Excel...');
    try {
      const chartEl = document.getElementById('ptw-weekly-chart-container');
      let chartBase64 = '';
      if (chartEl) {
        const canvas = await safeHtml2Canvas(chartEl, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#0f172a', // Slate-900 matching dashboard dark background
          scale: 2,
          logging: false,
        });
        chartBase64 = canvas.toDataURL('image/png');
      }
      toast.dismiss(toastId);

      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const monthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
      await exportPTWWeeklyReportToExcel(monthLabel, weeklyData, chartBase64);
    } catch (err) {
      console.error('Excel export failed:', err);
      toast.error('Gagal mengekspor laporan ke Excel');
      toast.dismiss(toastId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-sky-100/90 shadow-md text-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">PTW Management</h1>
              <p className="text-slate-500 text-sm font-medium">Kelola data Permit to Work secara terorganisir</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all border border-blue-500 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Tambah PTW Baru
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-6 bg-white/80 p-1.5 rounded-2xl border border-sky-100 shadow-sm w-fit">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === 'list'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Daftar PTW
          </button>
          <button
            onClick={() => setActiveSubTab('weekly')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === 'weekly'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Laporan Mingguan (Admin)
          </button>
        </div>
      )}

      {activeSubTab === 'list' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-sky-100/90 shadow-md text-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <Hash className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total PTW</p>
            <p className="text-2xl font-black text-slate-900">{records.length}</p>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-sky-100/90 shadow-md text-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Update Terbaru</p>
            <p className="text-lg font-black text-slate-900">
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
            className="w-full h-full pl-12 pr-4 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 shadow-md font-medium"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-sky-100/90 p-12 text-center shadow-md">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Memuat data...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-sky-100/90 p-12 text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Belum ada data PTW ditemukan</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white/90 backdrop-blur-xl px-6 py-4 rounded-2xl border border-sky-100/90 shadow-md text-slate-800">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Daftar Dokumen PTW</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportPTWListToExcel(filteredRecords)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
              <button
                onClick={() => exportPTWListToPDF(filteredRecords)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl border border-red-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
          {Object.keys(groupedRecords).sort().map((code) => {
            const groupRecords = groupedRecords[code];
            const isExpanded = !!expandedGroups[code];
            
            return (
              <div key={code} className="bg-white/90 backdrop-blur-xl rounded-2xl border border-sky-100/90 overflow-hidden shadow-lg transition-all duration-300 text-slate-800">
                {/* Collapsible Header */}
                <div
                  onClick={() => toggleGroup(code)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50/80 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm">
                      <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">{code}</h3>
                      <p className="text-slate-500 text-xs font-semibold">{groupRecords.length} Dokumen PTW</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(code, groupRecords);
                        }}
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition border border-red-500/20 flex items-center gap-1.5 relative z-10 cursor-pointer"
                        title={`Hapus Seluruh Kategori ${code}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-bold">Hapus Kategori</span>
                      </button>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                  </div>
                </div>

                {/* Collapsible Content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`accordion-content-${code}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="border-t border-slate-100 overflow-hidden"
                    >
                      <div className="p-4 sm:p-6 space-y-4">
                        <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-xl border border-slate-200/80 bg-slate-50/60 w-full shadow-inner">
                          <table className="w-full min-w-[800px]">
                            <thead className="bg-slate-100/90 border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-3.5 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Nomor PTW</th>
                                <th className="px-6 py-3.5 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Quarter</th>
                                <th className="px-6 py-3.5 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Masa Berlaku</th>
                                <th className="px-6 py-3.5 text-center text-xs font-black text-slate-600 uppercase tracking-wider">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/70 bg-white">
                              {groupRecords.map((record) => {
                                const isClosed = !!record.closingFileName || (!!record.endDate && record.endDate < new Date().toISOString().split('T')[0]);
                                return (
                                  <tr key={record.id} className="hover:bg-indigo-50/40 transition-colors group">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-extrabold text-indigo-900 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200/80 shadow-xs">
                                          {record.ptwNumber}
                                        </span>
                                        {isClosed && (
                                          <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 shadow-xs">
                                            SELESAI
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                        Q{parseInt(record.quarter)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Masa Berlaku</span>
                                        <span className="text-slate-800 font-bold">
                                          {new Date(record.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(record.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {record.fileName && record.totalChunks && (
                                          <>
                                            <button
                                              onClick={() => handlePreview(record)}
                                              className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition border border-indigo-200/80 shadow-xs cursor-pointer"
                                              title="Pratinjau PTW"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleDownload(record)}
                                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition border border-emerald-200/80 shadow-xs cursor-pointer"
                                              title="Download Lampiran"
                                            >
                                              <Download className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                        {record.closingFileName && record.closingTotalChunks && (
                                          <>
                                            <button
                                              onClick={() => handlePreviewClosing(record)}
                                              className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition border border-amber-200/80 shadow-xs cursor-pointer group/btn"
                                              title="Pratinjau Closing PTW"
                                            >
                                              <Eye className="w-4 h-4 text-amber-600 group-hover/btn:text-white" />
                                            </button>
                                            <button
                                              onClick={() => handleDownloadClosing(record)}
                                              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-200/80 shadow-xs cursor-pointer group/btn"
                                              title="Download Closing PTW"
                                            >
                                              <Download className="w-4 h-4 text-rose-600 group-hover/btn:text-white" />
                                            </button>
                                          </>
                                        )}
                                        {isAdmin && (
                                          <>
                                            <button
                                              onClick={() => openEditModal(record)}
                                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition border border-blue-200/80 shadow-xs cursor-pointer"
                                              title="Edit"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleDelete(record)}
                                              className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition border border-red-200/80 shadow-xs cursor-pointer"
                                              title="Hapus"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards inside group */}
                        <div className="md:hidden space-y-3">
                          {groupRecords.map((record) => {
                            const isClosed = !!record.closingFileName || (!!record.endDate && record.endDate < new Date().toISOString().split('T')[0]);
                            return (
                              <div key={record.id} className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-extrabold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200/80 shadow-xs">
                                      {record.ptwNumber}
                                    </span>
                                    {isClosed && (
                                      <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                        SELESAI
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-bold">
                                    Q{parseInt(record.quarter)}
                                  </span>
                                </div>
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-700 font-medium">
                                      {new Date(record.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(record.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                </div>
                                {((record.fileName && record.totalChunks) || (record.closingFileName && record.closingTotalChunks) || isAdmin) && (
                                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-200">
                                    {record.fileName && record.totalChunks && (
                                      <div className="flex items-center gap-2 w-full">
                                        <button
                                          onClick={() => handlePreview(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition border border-indigo-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Eye className="w-4 h-4" />
                                          Preview
                                        </button>
                                        <button
                                          onClick={() => handleDownload(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition border border-emerald-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Download className="w-4 h-4" />
                                          File
                                        </button>
                                      </div>
                                    )}
                                    {record.closingFileName && record.closingTotalChunks && (
                                      <div className="flex items-center gap-2 w-full">
                                        <button
                                          onClick={() => handlePreviewClosing(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition border border-amber-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Eye className="w-4 h-4" />
                                          Preview Closing
                                        </button>
                                        <button
                                          onClick={() => handleDownloadClosing(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Download className="w-4 h-4" />
                                          File Closing
                                        </button>
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <div className="flex items-center gap-2 w-full pt-1">
                                        <button
                                          onClick={() => openEditModal(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition border border-blue-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDelete(record)}
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition border border-red-200 text-sm font-semibold cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Hapus
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {activeSubTab === 'weekly' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Panel with Dropdowns and Export Buttons */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 mb-2 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-900">Filter Periode:</span>
              </div>
              
              <div className="flex gap-2">
                <select
                  title="Pilih Bulan"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(parseInt(e.target.value));
                    setSelectedWeek(1); // Reset to week 1 when month changes
                  }}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm"
                >
                  <option value={1}>Januari</option>
                  <option value={2}>Februari</option>
                  <option value={3}>Maret</option>
                  <option value={4}>April</option>
                  <option value={5}>Mei</option>
                  <option value={6}>Juni</option>
                  <option value={7}>Juli</option>
                  <option value={8}>Agustus</option>
                  <option value={9}>September</option>
                  <option value={10}>Oktober</option>
                  <option value={11}>November</option>
                  <option value={12}>Desember</option>
                </select>

                <select
                  title="Pilih Tahun"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value));
                    setSelectedWeek(1);
                  }}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportExcelReport}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-emerald-600 rounded-2xl border border-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Excel Laporan
              </button>
              <button
                onClick={handleExportPdfReport}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-red-600 rounded-2xl border border-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                PDF Laporan
              </button>
            </div>
          </div>

          {/* 4 or 5 Weeks Cards Grid */}
          <div className={weeklyData.length === 5 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" 
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          }>
            {weeklyData.map((wd) => {
              const isSelected = selectedWeek === wd.weekNum;
              return (
                <motion.div
                  key={wd.weekNum}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedWeek(wd.weekNum)}
                  className={`p-5 rounded-3xl backdrop-blur-xl border cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-300 shadow-md'
                      : 'bg-white/90 border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      isSelected 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      Minggu {wd.weekNum}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">{wd.shortRange}</span>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-3xl font-extrabold text-white tracking-tight">{wd.totalCount}</p>
                    <p className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">Total PTW</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/85 text-[11px]">
                    <div>
                      <span className="text-emerald-400 font-bold block">{wd.openCount}</span>
                      <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-tight">Open</span>
                    </div>
                    <div>
                      <span className="text-red-400 font-bold block">{wd.closedCount}</span>
                      <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-tight">Closed</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Chart and Detail Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Chart Column (Span 5) */}
            <div 
              id="ptw-weekly-chart-container"
              className="lg:col-span-5 ptw-weekly-chart-container backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col justify-between"
              style={{ minHeight: '350px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                <div>
                  <h3 className="text-lg font-bold mb-1 ptw-weekly-chart-title">Visualisasi Tren Validitas</h3>
                  <p className="text-xs ptw-weekly-chart-desc" style={{ color: '#94a3b8' }}>Tingkat kepatuhan open &amp; closed PTW mingguan</p>
                </div>

                {/* Monthly Summary Totals */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <div 
                    className="rounded-2xl text-center"
                    style={{
                      flex: '1 1 32%',
                      background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.3) 0%, rgba(88, 28, 135, 0.15) 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      padding: '10px 4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <p className="text-xl font-extrabold tracking-tight" style={{ color: '#c084fc', margin: 0, padding: 0 }}>{monthlyTotalPTW}</p>
                    <p className="text-[8px] uppercase font-bold tracking-widest mt-1" style={{ color: 'rgba(167, 139, 250, 0.8)', margin: 0, padding: 0 }}>Total PTW</p>
                  </div>
                  <div 
                    className="rounded-2xl text-center"
                    style={{
                      flex: '1 1 32%',
                      background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.3) 0%, rgba(21, 94, 117, 0.15) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      padding: '10px 4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <p className="text-xl font-extrabold tracking-tight" style={{ color: '#93c5fd', margin: 0, padding: 0 }}>{monthlyTotalOpen}</p>
                    <p className="text-[8px] uppercase font-bold tracking-widest mt-1" style={{ color: 'rgba(96, 165, 250, 0.8)', margin: 0, padding: 0 }}>Total Open</p>
                  </div>
                  <div 
                    className="rounded-2xl text-center"
                    style={{
                      flex: '1 1 32%',
                      background: 'linear-gradient(135deg, rgba(194, 65, 12, 0.3) 0%, rgba(180, 83, 9, 0.15) 100%)',
                      border: '1px solid rgba(249, 115, 22, 0.25)',
                      padding: '10px 4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <p className="text-xl font-extrabold tracking-tight" style={{ color: '#fdba74', margin: 0, padding: 0 }}>{monthlyTotalClosed}</p>
                    <p className="text-[8px] uppercase font-bold tracking-widest mt-1" style={{ color: 'rgba(251, 146, 60, 0.8)', margin: 0, padding: 0 }}>Total Closed</p>
                  </div>
                </div>
              </div>
              
              <div id="ptw-weekly-chart-raw" className="h-64 w-full" style={{ marginTop: '14px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="Total PTW" stroke="#a78bfa" strokeWidth={3} dot={{ fill: '#a78bfa', r: 4 }} />
                    <Bar dataKey="Open (Aktif)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20}>
                      <LabelList dataKey="Open (Aktif)" position="top" offset={10} style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} />
                    </Bar>
                    <Bar dataKey="Closed (Selesai)" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20}>
                      <LabelList dataKey="Closed (Selesai)" position="top" offset={10} style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Selected Week Table (Span 7) */}
            <div className="lg:col-span-7 bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-200 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase">Detail Minggu {selectedWeek}</h3>
                    <p className="text-slate-400 text-xs">{weeklyData[selectedWeek - 1].dateRange}</p>
                  </div>
                  <span className="px-3.5 py-1.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold shadow-md shadow-indigo-500/5">
                    {weeklyData[selectedWeek - 1].totalCount} Total PTW
                  </span>
                </div>

                {weeklyData[selectedWeek - 1].records.length === 0 ? (
                  <div className="py-16 text-center">
                    <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm italic">Tidak ada PTW aktif pada minggu ini</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20 max-h-72 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-850">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">No.</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Nomor PTW</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Nama Maintenance</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Masa Berlaku</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {weeklyData[selectedWeek - 1].records.map((rec, idx) => {
                          const isClosed = !!rec.closingFileName || (!!rec.endDate && rec.endDate < new Date().toISOString().split('T')[0]);
                          return (
                            <tr key={rec.id} className="hover:bg-slate-800/10 transition">
                              <td className="px-4 py-3 text-xs font-medium text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 text-xs font-bold text-white whitespace-nowrap">
                                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700/50">
                                  {rec.ptwNumber}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-300 max-w-[180px] truncate" title={rec.notes}>
                                {rec.notes || '-'}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                                {new Date(rec.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(rec.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isClosed 
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {isClosed ? 'SELESAI' : 'AKTIF'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <div key="add-edit-modal-wrapper" className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-10 overflow-y-auto">
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
                onDragEnter={isAddModalOpen ? handleDragEnter : undefined}
                className={`relative w-full ${isAddModalOpen ? 'max-w-2xl' : 'max-w-lg'} bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto`}
              >
                <AnimatePresence>
                  {isAddModalOpen && isDragging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className="absolute inset-0 bg-slate-950/85 backdrop-blur-md border-2 border-dashed border-indigo-500 rounded-3xl z-50 flex flex-col items-center justify-center gap-4 transition-all duration-300 pointer-events-auto"
                    >
                      <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="p-5 bg-indigo-500/20 rounded-full border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                      >
                        <FileUp className="w-10 h-10 text-indigo-400" />
                      </motion.div>
                      <div className="text-center px-6">
                        <p className="text-lg font-bold text-white mb-1">Lepaskan PDF PTW Anda di Sini</p>
                        <p className="text-sm text-indigo-300">Sistem akan otomatis memindai dan mengekstrak datanya</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ClipboardIcon className="w-6 h-6 text-indigo-400" />
                  {isEditModalOpen ? 'Edit Data PTW' : 'Tambah PTW Baru (Multi-File)'}
                </h2>
                <button 
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} 
                  className="p-2 text-slate-400 hover:text-white transition"
                  title="Tutup"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {isEditModalOpen ? (
                // ===== EDIT FORM =====
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="ptw-sequence" className="text-xs font-bold text-slate-500 uppercase ml-1">Sequence Number</label>
                      <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                        <input
                          id="ptw-sequence"
                          title="Sequence Number"
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
                      <label htmlFor="ptw-quarter" className="text-xs font-bold text-slate-500 uppercase ml-1">Quarter</label>
                      <div className="relative group">
                        <select
                          id="ptw-quarter"
                          title="Quarter"
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
                    <label htmlFor="ptw-equipment" className="text-xs font-bold text-slate-500 uppercase ml-1">Equipment Code</label>
                    <div className="relative group">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                      <input
                        id="ptw-equipment"
                        title="Equipment Code"
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
                      <label htmlFor="ptw-start-date" className="text-xs font-bold text-slate-500 uppercase ml-1">Masa Berlaku (Dari)</label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                        <input
                          id="ptw-start-date"
                          title="Tanggal Mulai Masa Berlaku"
                          type="date"
                          required
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full pl-11 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="ptw-end-date" className="text-xs font-bold text-slate-500 uppercase ml-1">Sampai Dengan</label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition" />
                        <input
                          id="ptw-end-date"
                          title="Tanggal Akhir Masa Berlaku"
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
                    <label htmlFor="ptw-notes" className="text-xs font-bold text-slate-500 uppercase ml-1">Catatan (Opsional)</label>
                    <textarea
                      id="ptw-notes"
                      title="Catatan Tambahan"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition h-24 resize-none"
                      placeholder="Masukkan catatan tambahan..."
                    />
                  </div>

                  <div className="space-y-3">
                    <label htmlFor="ptw-file-input" className="text-xs font-bold text-slate-500 uppercase ml-1">File Lampiran (Max 10MB)</label>
                    
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-[11px] font-bold text-amber-400 leading-tight">
                        FILE PTW YANG DIUPLOAD HARUS YANG SUDAH TTD TDE
                      </p>
                    </div>

                    {selectedRecord?.totalChunks && selectedRecord?.fileName && !selectedFile && !shouldDeleteFile && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-2">
                        <File className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-emerald-300 truncate flex-1">{selectedRecord.fileName}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => handleDownload(selectedRecord)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition" title="Unduh">
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShouldDeleteFile(true)} 
                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition" 
                            title="Hapus Lampiran"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    <label htmlFor="ptw-file-input" className="flex items-center gap-3 px-5 py-3.5 bg-white/5 border border-white/10 border-dashed rounded-2xl text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition cursor-pointer">
                      <FileUp className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm truncate">
                        {selectedFile ? selectedFile.name : 'Pilih file PDF PTW untuk diunggah...'}
                      </span>
                      <input
                        id="ptw-file-input"
                        title="Pilih File Lampiran"
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf"
                      />
                    </label>
                  </div>

                  {/* File Closing PTW Section */}
                  <div className="space-y-3">
                    <label htmlFor="ptw-closing-file-input" className="text-xs font-bold text-slate-500 uppercase ml-1">File Closing PTW (Opsional) (Max 10MB)</label>
                    
                    {selectedRecord?.closingTotalChunks && selectedRecord?.closingFileName && !selectedClosingFile && !shouldDeleteClosingFile && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl mb-2">
                        <File className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300 truncate flex-1">{selectedRecord.closingFileName}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => handleDownloadClosing(selectedRecord)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition" title="Unduh Closing">
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShouldDeleteClosingFile(true)} 
                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition" 
                            title="Hapus Closing"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    <label htmlFor="ptw-closing-file-input" className="flex items-center gap-3 px-5 py-3.5 bg-white/5 border border-white/10 border-dashed rounded-2xl text-slate-400 hover:border-red-500/50 hover:text-red-400 transition cursor-pointer">
                      <FileUp className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm truncate">
                        {selectedClosingFile ? selectedClosingFile.name : 'Pilih file PDF Closing PTW...'}
                      </span>
                      <input
                        id="ptw-closing-file-input"
                        title="Pilih File Closing"
                        type="file"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > MAX_FILE_SIZE) {
                              toast.error('File terlalu besar. Maksimal 10MB.');
                              return;
                            }

                            // Check if file is already uploaded
                            const isDuplicate = records.some(r => r.fileName === file.name || r.closingFileName === file.name);
                            if (isDuplicate) {
                              const confirmUpload = await askConfirmation(`File "${file.name}" sudah pernah di-upload sebelumnya. Apakah Anda yakin ingin tetap mengunggahnya?`);
                              if (!confirmUpload) {
                                e.target.value = '';
                                return;
                              }
                            }

                            setSelectedClosingFile(file);
                            setShouldDeleteClosingFile(false);
                          }
                        }}
                        className="hidden"
                        accept=".pdf"
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
                          Perbarui PTW
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // ===== ADD MULTI-FILE QUEUE MANAGER =====
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-amber-400 leading-tight">
                      FILE PTW YANG DIUPLOAD HARUS YANG SUDAH TTD TDE. SISTEM AKAN MELAKUKAN AUTO-SCAN UNTUK SETIAP FILE PDF.
                    </p>
                  </div>

                  {queuedItems.length === 0 ? (
                    /* Dropzone when queue is empty */
                    <div className="space-y-4">
                      <label 
                        htmlFor="ptw-multi-file-input" 
                        className="flex flex-col items-center justify-center gap-4 px-6 py-12 bg-white/5 border-2 border-white/10 border-dashed rounded-3xl text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition cursor-pointer group"
                      >
                        <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:scale-110 transition-transform">
                          <FileUp className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-white mb-1">Pilih beberapa file PDF PTW Anda</p>
                          <p className="text-xs text-slate-500">Seret berkas ke sini atau klik untuk menelusuri (Maks. 10MB per berkas)</p>
                        </div>
                        <input
                          id="ptw-multi-file-input"
                          title="Pilih Beberapa File Lampiran"
                          type="file"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          accept=".pdf"
                        />
                      </label>
                      
                      <div className="text-center">
                        <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Atau</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddManualQueueItem}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-sm border border-white/10 transition flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Input Data PTW Secara Manual
                      </button>
                    </div>
                  ) : (
                    /* Queue Manager List */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Daftar Berkas Antrean ({queuedItems.length})
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleAddManualQueueItem}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-white/10 transition flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Manual
                          </button>
                          
                          <label 
                            htmlFor="ptw-multi-file-input-more" 
                            className="px-3.5 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-xs font-bold border border-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            Tambah Berkas
                            <input
                              id="ptw-multi-file-input-more"
                              title="Pilih Berkas Tambahan"
                              type="file"
                              multiple
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".pdf"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Scrollable Queue Card List */}
                      <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                        {queuedItems.map((item, idx) => {
                          const isComplete = item.sequenceNumber && item.equipmentCode && item.quarter && item.startDate && item.endDate;
                          return (
                            <div key={item.id} className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden shadow-xl transition hover:border-white/10">
                              {/* Card Header */}
                              <div 
                                onClick={() => toggleQueueItemExpanded(item.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
                                  <div className={`p-2 rounded-xl flex-shrink-0 ${item.file ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                    <File className="w-5 h-5" />
                                  </div>
                                  <div className="overflow-hidden flex-1">
                                    <h4 className="text-sm font-bold text-white truncate">
                                      {item.file ? item.file.name : `Data PTW Manual #${idx + 1}`}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      {item.isScanning ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 animate-pulse bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10">
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          <span>{item.scanStatus || 'Memindai PDF...'}</span>
                                        </div>
                                      ) : item.scanSource === 'filename' ? (
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-1">
                                          ⚡ Instan (Nama File)
                                        </span>
                                      ) : item.scanSource === 'ocr' ? (
                                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded-full border border-blue-500/10 flex items-center gap-1">
                                          🔍 Scan Selesai (OCR)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-500/5 px-2 py-0.5 rounded-full border border-slate-500/10 flex items-center gap-1">
                                          ✍️ Input Manual
                                        </span>
                                      )}

                                      {/* Completeness Badge */}
                                      {isComplete ? (
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                          ✓ Lengkap
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                          ⚠️ Belum Lengkap
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQueueItem(item.id)}
                                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition border border-red-500/20 cursor-pointer"
                                    title="Hapus dari antrean"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleQueueItemExpanded(item.id)}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                                    title="Tampilkan detail"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${item.isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              {/* Accordion Content */}
                              <AnimatePresence initial={false}>
                                {item.isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="border-t border-white/5 bg-slate-900/50 p-4 space-y-4"
                                  >
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">No. Urut</label>
                                        <input
                                          type="number"
                                          required
                                          value={item.sequenceNumber}
                                          onChange={(e) => updateQueueItemField(item.id, 'sequenceNumber', e.target.value)}
                                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                                          placeholder="Contoh: 0518"
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Quarter</label>
                                        <div className="relative group">
                                          <select
                                            title="Pilih Quarter"
                                            required
                                            value={item.quarter}
                                            onChange={(e) => updateQueueItemField(item.id, 'quarter', e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer"
                                          >
                                            <option value="">Pilih Quarter</option>
                                            <option value="1">Q1</option>
                                            <option value="2">Q2</option>
                                            <option value="3">Q3</option>
                                            <option value="4">Q4</option>
                                          </select>
                                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Equipment Code</label>
                                      <input
                                        type="text"
                                        required
                                        value={item.equipmentCode}
                                        onChange={(e) => updateQueueItemField(item.id, 'equipmentCode', e.target.value.toUpperCase())}
                                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                                        placeholder="Contoh: AHU"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Masa Berlaku (Mulai)</label>
                                        <input
                                          type="date"
                                          required
                                          title="Masa Berlaku Mulai"
                                          placeholder="YYYY-MM-DD"
                                          value={item.startDate}
                                          onChange={(e) => updateQueueItemField(item.id, 'startDate', e.target.value)}
                                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sampai Dengan</label>
                                        <input
                                          type="date"
                                          required
                                          title="Masa Berlaku Selesai"
                                          placeholder="YYYY-MM-DD"
                                          value={item.endDate}
                                          onChange={(e) => updateQueueItemField(item.id, 'endDate', e.target.value)}
                                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Catatan / Nama Maintenance</label>
                                      <textarea
                                        value={item.notes}
                                        onChange={(e) => updateQueueItemField(item.id, 'notes', e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition h-20 resize-none"
                                        placeholder="Contoh: PM AHU 4"
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {submitting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase px-1">
                        <span>Mengunggah Berkas Antrean...</span>
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

                  {queuedItems.length > 0 && (
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-3 cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Menyimpan {queuedItems.length} Data PTW...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-6 h-6" />
                            Simpan Semua ({queuedItems.length}) Data PTW
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </form>
              )}
              </motion.div>
            </div>
          )}

          {isDeleteModalOpen && (
            <div key="delete-modal-wrapper" className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
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
                className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 text-center"
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
                    className="flex-1 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition"
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

          {isDeleteCategoryModalOpen && (
            <div key="delete-category-modal-wrapper" className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteCategoryModalOpen(false)}
                className="fixed inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 text-center"
              >
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                  <Trash2 className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Hapus Kategori PTW?</h3>
                <p className="text-slate-400 mb-8">
                  Apakah Anda yakin ingin menghapus kategori <span className="text-white font-bold">{categoryToDelete?.name}</span> beserta seluruh <span className="text-white font-bold">{categoryToDelete?.records.length}</span> dokumen PTW di dalamnya?
                  Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsDeleteCategoryModalOpen(false)}
                    className="flex-1 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    disabled={submitting}
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-2xl font-bold shadow-xl shadow-red-900/20 transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Ya, Hapus Semua'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {confirmModalOpen && (
            <div key="confirm-modal-wrapper" className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => handleConfirmResponse(false)}
                className="fixed inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 text-center"
              >
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">File Sudah Ada</h3>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                  {confirmModalMessage}
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleConfirmResponse(false)}
                    className="flex-1 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmResponse(true)}
                    className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold shadow-xl shadow-amber-900/20 transition cursor-pointer"
                  >
                    Tetap Upload
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
