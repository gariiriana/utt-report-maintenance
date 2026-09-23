// ============================================================================
// FILE: frontend/components/AbnormalFindingsCenter.tsx
// Deskripsi: Pusat Monitoring Temuan Kondisi Abnormal Khusus Akun QC DME (qcdme@dme.com).
//            Menampilkan seluruh data kondisi abnormal/kerusakan unit dari setiap
//            akun maintenance & role engineer (PUMP, CHILLER, PAC, TRAFO, UPS, ATS, dll),
//            dilengkapi penyaringan per akun, preview foto bukti, ekspor Excel rekap,
//            serta wewenang QC untuk menandai unit normal kembali setelah perbaikan.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Search,
  Camera,
  CheckCircle2,
  Calendar,
  X,
  FileSpreadsheet,
  FileText,
  Download,
  FolderOpen,
  User,
  RefreshCw,
  Wrench,
  ShieldCheck,
  Loader2,
  PenTool,
  Eye,
  Trash2,
  Scissors,
  Crop,
  Brain,
  Users,
  Layers,
  LayoutGrid,
  List,
  RotateCcw
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { offlineReportStorage } from '@/utils/offlineReportStorage';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import { exportAbnormalRecapToWord } from '@/utils/AbnormalRecapWordExport';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoK2 from '@/assets/logo_k2.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { AbnormalFinding, ExcelDocument } from './DocumentList';
import { AbnormalReportModal } from './AbnormalReportModal';
import { ImageEditor } from './ImageEditor';
import { autoCropTextFromImage } from '@/utils/cropUtils';
import { PredictiveReportModal } from './PredictiveReportModal';
import { generatePredictiveReportAI } from '@/utils/aiPredictiveAgent';
import { PredictiveReportData } from '@/types/predictiveReportTypes';

export interface AbnormalItem {
  id: string;
  docId: string;
  collectionName: 'pdf_documents' | 'excel_documents' | 'hse' | 'findings';
  documentType: 'pdf' | 'excel' | 'hse';
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  companyType?: 'neutra' | 'bri' | 'k2';
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  hasAbnormal: boolean;
  abnormalFinding: AbnormalFinding;
  attachedSrFile?: any;
  attachedSrBase64?: string;
  findingId?: string;
  partName?: string;
  partNumber?: string;
  brandName?: string;
  quantity?: string | number;
  hasPredictiveReport?: boolean;
  predictiveReportId?: string;
  predictiveReportNumber?: string;
  predictiveHealthStatus?: 'Critical' | 'Warning' | 'Caution';
  predictiveRemainingLife?: string;
  predictiveReportData?: PredictiveReportData;
}

interface AbnormalFindingsCenterProps {
  onNavigateToDocument?: (searchQuery: string) => void;
}

// Helper ekstraksi data bulan & tahun dari laporan temuan abnormal
export function getItemMonthData(item: AbnormalItem): { key: string; label: string; date: Date } {
  let targetDate: Date = item.createdAt || new Date();

  // 1. Prioritas dari findingDate
  if (item.abnormalFinding?.findingDate) {
    const raw = String(item.abnormalFinding.findingDate).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    } else {
      const match = raw.match(/(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})/);
      if (match) {
        const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        if (!isNaN(parsed.getTime())) targetDate = parsed;
      }
    }
  } else if (item.abnormalFinding?.reportedAt) {
    const raw = item.abnormalFinding.reportedAt;
    const d = new Date(raw as any);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    }
  } else if (item.maintenanceTime) {
    const raw = String(item.maintenanceTime).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    } else {
      const match = raw.match(/(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})/);
      if (match) {
        const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        if (!isNaN(parsed.getTime())) targetDate = parsed;
      }
    }
  }

  const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const label = targetDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return { key, label, date: targetDate };
}

export function formatWaktuMaintenance(item: AbnormalItem): string {
  if (!item.maintenanceTime) return '-';
  if (item.collectionName === 'findings') {
    const { label } = getItemMonthData(item);
    return label;
  }
  return item.maintenanceTime;
}

export function AbnormalFindingsCenter({ onNavigateToDocument }: AbnormalFindingsCenterProps) {
  const { user, userRole, companyType } = useAuth();
  // Aksi hapus di pusat temuan ini sengaja eksklusif untuk satu akun QC DME.
  const canDelete = user?.email?.toLowerCase() === 'qcdme@dme.com';

  const [items, setItems] = useState<AbnormalItem[]>([]);
  const [sourceCounts, setSourceCounts] = useState({ documents: 0, findings: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [recapStartMonth, setRecapStartMonth] = useState<string>('all');
  const [recapEndMonth, setRecapEndMonth] = useState<string>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState<'all' | 'pdf' | 'excel' | 'hse'>('all');
  const [selectedPhotoFilter, setSelectedPhotoFilter] = useState<'all' | 'with_photo' | 'without_photo'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'unit_asc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Preview lightbox photo state
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string; unit: string; account: string; item?: AbnormalItem } | null>(null);

  // Modal konfirmasi tandai normal oleh QC
  const [confirmNormalItem, setConfirmNormalItem] = useState<AbnormalItem | null>(null);
  const [isProcessingNormal, setIsProcessingNormal] = useState(false);

  // Modal konfirmasi hapus temuan oleh QC DME
  const [deleteTargetItem, setDeleteTargetItem] = useState<AbnormalItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal pop-up lihat detail lengkap temuan abnormal
  const [viewingDetailItem, setViewingDetailItem] = useState<AbnormalItem | null>(null);

  // Modal edit / lengkapi temuan abnormal
  const [editingModalDoc, setEditingModalDoc] = useState<ExcelDocument | null>(null);

  // Modal crop foto temuan abnormal (ImageEditor)
  const [editingCropItem, setEditingCropItem] = useState<AbnormalItem | null>(null);

  // Modal Predictive Maintenance Report (AI Agent)
  const [predictiveModalOpen, setPredictiveModalOpen] = useState(false);
  const [activePredictiveItem, setActivePredictiveItem] = useState<AbnormalItem | null>(null);
  const [activePredictiveData, setActivePredictiveData] = useState<PredictiveReportData | null>(null);
  const [isLoadingPredictive, setIsLoadingPredictive] = useState(false);

  // Helper konversi AbnormalItem ke ExcelDocument untuk AbnormalReportModal
  const itemToExcelDoc = (item: AbnormalItem): ExcelDocument => ({
    id: item.docId,
    fileName: item.fileName,
    maintenanceName: item.maintenanceName,
    maintenanceTime: item.maintenanceTime,
    specificDetail: item.specificDetail,
    documentType: item.documentType,
    collectionName: item.collectionName,
    hasAbnormal: item.hasAbnormal,
    abnormalFinding: item.abnormalFinding,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    fileSize: 0,
    totalPhotos: 0,
    photosWithImage: 0,
    photosData: []
  });

  // Handler: Hapus temuan abnormal oleh akun QC DME / Admin
  const handleDeleteAbnormal = async () => {
    if (!deleteTargetItem || !canDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading('Menghapus data temuan abnormal...');
    try {
      if (deleteTargetItem.collectionName === 'findings') {
        await deleteDoc(doc(db, 'findings', deleteTargetItem.docId));
      } else {
        await updateDoc(doc(db, deleteTargetItem.collectionName, deleteTargetItem.docId), {
          hasAbnormal: false,
          abnormalFinding: deleteField(),
          updatedAt: serverTimestamp(),
        });
        await offlineReportStorage.updateReportAbnormal(deleteTargetItem.docId, false, null);
        if (deleteTargetItem.findingId) {
          await deleteDoc(doc(db, 'findings', deleteTargetItem.findingId)).catch(() => {});
        }
      }

      toast.success('Data temuan abnormal berhasil dihapus!', { id: toastId });
      setItems(prev => prev.filter(it => it.id !== deleteTargetItem.id));
      if (viewingDetailItem?.id === deleteTargetItem.id) {
        setViewingDetailItem(null);
      }
      setDeleteTargetItem(null);
    } catch (err: any) {
      console.error('Error deleting abnormal finding:', err);
      toast.error(`Gagal menghapus temuan: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleDeleteSelection = (itemId: string) => {
    setSelectedDeleteIds((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedDeleteIds((previous) => {
      const next = new Set(previous);
      const everyFilteredItemSelected = filteredItems.length > 0 && filteredItems.every((item) => next.has(item.id));
      filteredItems.forEach((item) => {
        if (everyFilteredItemSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  };

  const handleBulkDeleteAbnormal = async () => {
    if (!canDelete) return;
    const selectedItems = items.filter((item) => selectedDeleteIds.has(item.id));
    if (selectedItems.length === 0) return;

    setIsBulkDeleting(true);
    const toastId = toast.loading(`Menghapus ${selectedItems.length} data temuan abnormal...`);
    try {
      // Firestore membatasi satu batch menjadi 500 operasi. Pecah per 200 item agar
      // penghapusan tetap aman jika seluruh daftar temuan dipilih.
      for (let start = 0; start < selectedItems.length; start += 200) {
        const batch = writeBatch(db);
        const batchItems = selectedItems.slice(start, start + 200);
        const queuedPaths = new Set<string>();
        const queueDelete = (collectionName: string, documentId: string) => {
          const path = `${collectionName}/${documentId}`;
          if (!queuedPaths.has(path)) {
            batch.delete(doc(db, collectionName, documentId));
            queuedPaths.add(path);
          }
        };

        batchItems.forEach((item) => {
          if (item.collectionName === 'findings') {
            queueDelete('findings', item.docId);
            return;
          }

          const documentPath = `${item.collectionName}/${item.docId}`;
          if (!queuedPaths.has(documentPath)) {
            batch.update(doc(db, item.collectionName, item.docId), {
              hasAbnormal: false,
              abnormalFinding: deleteField(),
              updatedAt: serverTimestamp(),
            });
            queuedPaths.add(documentPath);
          }
          if (item.findingId) queueDelete('findings', item.findingId);
        });
        await batch.commit();
      }

      await Promise.all(
        selectedItems
          .filter((item) => item.collectionName !== 'findings')
          .map((item) => offlineReportStorage.updateReportAbnormal(item.docId, false, null).catch(() => {}))
      );
      setItems((previous) => previous.filter((item) => !selectedDeleteIds.has(item.id)));
      setSelectedDeleteIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
      toast.success(`${selectedItems.length} data temuan abnormal berhasil dihapus.`, { id: toastId });
    } catch (err: any) {
      console.error('Error bulk deleting abnormal findings:', err);
      toast.error(`Gagal menghapus data terpilih: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Handler: Potong otomatis bagian teks atas dan hanya simpan foto dokumentasi unit
  const handleAutoCropText = async (targetItem: AbnormalItem) => {
    const rawPhoto = targetItem.abnormalFinding?.photoBase64;
    if (!rawPhoto) {
      toast.error('Tidak ada foto bukti yang dapat dipotong.');
      return;
    }

    const toastId = toast.loading('Memotong bagian teks dan mengambil foto saja...');
    try {
      const croppedBase64 = await autoCropTextFromImage(rawPhoto, 0.46);

      // Simpan perubahan ke Firestore
      if (targetItem.collectionName === 'findings') {
        await updateDoc(doc(db, 'findings', targetItem.findingId || targetItem.docId), {
          photoBase64: croppedBase64,
          photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, targetItem.collectionName, targetItem.docId), {
          'abnormalFinding.photoBase64': croppedBase64,
          'abnormalFinding.photos': [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
          updatedAt: serverTimestamp(),
        });
      }

      // Update offline storage juga
      await offlineReportStorage.updateReportAbnormal(
        targetItem.docId,
        true,
        {
          ...(targetItem.abnormalFinding || {}),
          photoBase64: croppedBase64,
          photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
        }
      );

      // Update local state items
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === targetItem.id) {
            return {
              ...it,
              abnormalFinding: {
                ...it.abnormalFinding,
                photoBase64: croppedBase64,
                photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
              },
            };
          }
          return it;
        })
      );

      // Update viewingDetailItem jika sedang terbuka di pop-up
      if (viewingDetailItem && viewingDetailItem.id === targetItem.id) {
        setViewingDetailItem((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            abnormalFinding: {
              ...prev.abnormalFinding,
              photoBase64: croppedBase64,
              photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
            },
          };
        });
      }

      toast.success('Berhasil! Bagian teks telah dibuang, kini hanya menyisakan foto dokumentasi.', { id: toastId });
    } catch (err: any) {
      console.error('Error auto cropping finding photo:', err);
      toast.error(`Gagal memotong foto: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  // Handler: Simpan hasil pemotongan foto manual via ImageEditor
  const handleSaveManualCrop = async (newBase64: string) => {
    if (!editingCropItem) return;
    const targetItem = editingCropItem;
    setEditingCropItem(null);

    const toastId = toast.loading('Menyimpan hasil potongan foto bukti...');
    try {
      if (targetItem.collectionName === 'findings') {
        await updateDoc(doc(db, 'findings', targetItem.findingId || targetItem.docId), {
          photoBase64: newBase64,
          photos: [{ base64: newBase64, description: 'Bukti Temuan Abnormal' }],
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, targetItem.collectionName, targetItem.docId), {
          'abnormalFinding.photoBase64': newBase64,
          'abnormalFinding.photos': [{ base64: newBase64, description: 'Bukti Temuan Abnormal' }],
          updatedAt: serverTimestamp(),
        });
      }

      await offlineReportStorage.updateReportAbnormal(
        targetItem.docId,
        true,
        {
          ...(targetItem.abnormalFinding || {}),
          photoBase64: newBase64,
          photos: [{ base64: newBase64, description: 'Bukti Temuan Abnormal' }],
        }
      );

      setItems((prev) =>
        prev.map((it) => {
          if (it.id === targetItem.id) {
            return {
              ...it,
              abnormalFinding: {
                ...it.abnormalFinding,
                photoBase64: newBase64,
                photos: [{ base64: newBase64, description: 'Bukti Temuan Abnormal' }],
              },
            };
          }
          return it;
        })
      );

      if (viewingDetailItem && viewingDetailItem.id === targetItem.id) {
        setViewingDetailItem((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            abnormalFinding: {
              ...prev.abnormalFinding,
              photoBase64: newBase64,
              photos: [{ base64: newBase64, description: 'Bukti Temuan Abnormal' }],
            },
          };
        });
      }

      if (previewPhoto) {
        setPreviewPhoto((prev) => (prev ? { ...prev, src: newBase64 } : null));
      }

      toast.success('Foto bukti temuan abnormal berhasil diperbarui!', { id: toastId });
    } catch (err: any) {
      console.error('Error saving cropped photo:', err);
      toast.error(`Gagal menyimpan foto: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  // Handler: Potong otomatis gambar yang sedang dibuka di modal Lightbox (previewPhoto)
  const handleCropPreviewPhoto = async () => {
    if (!previewPhoto?.src) return;
    const toastId = toast.loading('Memotong bagian teks dan menyisakan foto saja...');
    try {
      const croppedBase64 = await autoCropTextFromImage(previewPhoto.src, 0.46);

      // Langsung perbarui tampilan modal lightbox secara instan
      setPreviewPhoto((prev) => (prev ? { ...prev, src: croppedBase64 } : null));

      // Cari item yang terkait
      const targetItem =
        previewPhoto.item ||
        items.find(
          (it) =>
            it.abnormalFinding?.photoBase64 === previewPhoto.src ||
            (it.abnormalFinding?.unitName === previewPhoto.unit && it.createdBy === previewPhoto.account)
        );

      if (targetItem) {
        if (targetItem.collectionName === 'findings') {
          await updateDoc(doc(db, 'findings', targetItem.findingId || targetItem.docId), {
            photoBase64: croppedBase64,
            photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, targetItem.collectionName, targetItem.docId), {
            'abnormalFinding.photoBase64': croppedBase64,
            'abnormalFinding.photos': [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
            updatedAt: serverTimestamp(),
          });
        }

        if (targetItem.findingId) {
          await updateDoc(doc(db, 'findings', targetItem.findingId), {
            photoBase64: croppedBase64,
            photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }

        await offlineReportStorage.updateReportAbnormal(targetItem.docId, true, {
          ...(targetItem.abnormalFinding || {}),
          photoBase64: croppedBase64,
          photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
        });

        setItems((prev) =>
          prev.map((it) => {
            if (it.id === targetItem.id) {
              return {
                ...it,
                abnormalFinding: {
                  ...it.abnormalFinding,
                  photoBase64: croppedBase64,
                  photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
                },
              };
            }
            return it;
          })
        );

        if (viewingDetailItem && viewingDetailItem.id === targetItem.id) {
          setViewingDetailItem((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              abnormalFinding: {
                ...prev.abnormalFinding,
                photoBase64: croppedBase64,
                photos: [{ base64: croppedBase64, description: 'Bukti Temuan Abnormal' }],
              },
            };
          });
        }
      }

      toast.success('Berhasil! Bagian teks telah dibuang, kini hanya menyisakan foto dokumentasi.', { id: toastId });
    } catch (err: any) {
      console.error('Error auto cropping preview photo:', err);
      toast.error(`Gagal memotong foto: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  // Handler: Buka / Generate Laporan Predictive Maintenance AI dari temuan abnormal
  const handleOpenPredictiveModal = async (item: AbnormalItem) => {
    setActivePredictiveItem(item);
    setIsLoadingPredictive(true);
    const toastId = toast.loading('Mempersiapkan Laporan Predictive Maintenance...');

    try {
      // 1. Cek jika sudah memiliki laporan prediktif yang tersimpan di memory / item
      if (item.predictiveReportData) {
        setActivePredictiveData(item.predictiveReportData);
        setPredictiveModalOpen(true);
        toast.dismiss(toastId);
        return;
      }

      // 2. Cek jika sudah memiliki reportId yang tersimpan di Firestore
      if (item.predictiveReportId) {
        const pSnap = await getDoc(doc(db, 'predictive_reports', item.predictiveReportId));
        if (pSnap.exists()) {
          const pData = pSnap.data() as PredictiveReportData;
          setActivePredictiveData(pData);
          setPredictiveModalOpen(true);
          toast.dismiss(toastId);
          return;
        }
      }

      // 3. Jika belum ada laporan prediktif, generate via AI Reliability Agent
      toast.loading('AI Agent sedang menganalisis temuan abnormal untuk PdM...', { id: toastId });
      const photoB64 = item.abnormalFinding?.photoBase64 || (item.abnormalFinding?.photos && item.abnormalFinding.photos[0]?.base64) || undefined;
      const equipName = item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName || 'Critical Equipment';
      const desc = item.abnormalFinding?.description || 'Terdeteksi kondisi abnormal pada peralatan fasilitas.';

      const generated = await generatePredictiveReportAI({
        sourceDocId: item.docId,
        sourceCollection: item.collectionName as any,
        sourceTicketNumber: item.fileName || undefined,
        sourceMaintenanceName: item.maintenanceName,
        sourceMaintenanceDate: item.maintenanceTime || new Date().toISOString().split('T')[0],
        equipmentName: equipName,
        locationRoom: 'Data Center NeutraDC Cikarang',
        descriptionOrSymptoms: desc,
        recommendation: item.abnormalFinding?.actionRecommendation || undefined,
        photoEvidenceBase64: photoB64,
        userEmail: user?.email || undefined,
        userName: user?.displayName || undefined,
      }, (msg) => {
        toast.loading(msg, { id: toastId });
      });

      setActivePredictiveData(generated);
      setPredictiveModalOpen(true);
      toast.success('Laporan Prediktif AI siap ditinjau!', { id: toastId });
    } catch (err: any) {
      console.error('Error opening predictive report modal:', err);
      toast.error(`Gagal memuat laporan prediktif: ${err?.message || 'Terjadi kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsLoadingPredictive(false);
    }
  };

  // Real-time listener ke seluruh koleksi dokumen yang berstatus hasAbnormal == true & koleksi findings
  useEffect(() => {
    setLoading(true);

    let pdfList: AbnormalItem[] = [];
    let excelList: AbnormalItem[] = [];
    let hseList: AbnormalItem[] = [];
    let findingsList: any[] = [];

    const updateAll = () => {
      const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedFindingIds = new Set<string>();

      // Helper pembanding tanggal fleksibel (mendukung format "02 Sep 2026", "2026-09-02", "02/09/2026")
      const datesCompatible = (d1?: string, d2?: string): boolean => {
        if (!d1 || !d2) return true;
        if (d1 === d2) return true;

        // Cek kecocokan tahun (4 digit)
        const y1 = d1.match(/\b(20\d\d)\b/)?.[1];
        const y2 = d2.match(/\b(20\d\d)\b/)?.[1];
        if (y1 && y2 && y1 !== y2) return false;

        // Cek kecocokan bulan (nama bulan ID/EN atau angka MM)
        const getMonthNum = (str: string): number => {
          const s = str.toLowerCase();
          const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'may', 'jun', 'jul', 'agu', 'aug', 'sep', 'okt', 'oct', 'nop', 'nov', 'des', 'dec'];
          for (let i = 0; i < months.length; i++) {
            if (s.includes(months[i])) return Math.floor(i / 2) + 1;
          }
          const mIso = s.match(/^\d{4}-(\d{2})-\d{2}/);
          if (mIso) return parseInt(mIso[1], 10);
          return 0;
        };

        const m1 = getMonthNum(d1);
        const m2 = getMonthNum(d2);
        if (m1 > 0 && m2 > 0 && m1 !== m2) return false;

        return true;
      };

      const enrichItemWithFinding = (it: AbnormalItem): AbnormalItem => {
        const currentDesc = it.abnormalFinding?.description || '';
        const isGenericFallback = !currentDesc || 
          currentDesc === 'Temuan abnormal tercatat pada dokumen ini.' || 
          currentDesc === 'Temuan abnormal tercatat pada dokumen HSE ini.' ||
          currentDesc === 'Ditemukan kondisi kelainan / abnormal pada unit ini.' ||
          currentDesc.startsWith('Temuan abnormal pada part:');

        const sCreated = normalize(it.createdBy);
        const sSpec = normalize(it.specificDetail);
        const sMaint = normalize(it.maintenanceName);

        const matched = findingsList.find(f => {
          if (!f || matchedFindingIds.has(f.id)) return false;

          // 1. Strict ID matching (prioritas utama)
          if (it.docId && f.docId && it.docId === f.docId) return true;
          if (it.docId && f.reportId && it.docId === f.reportId) return true;
          if (it.findingId && f.id && it.findingId === f.id) return true;

          // 2. Creator matching
          const fCreated = normalize(f.createdByEmail);
          const creatorMatch = sCreated && fCreated && (
            sCreated === fCreated ||
            sCreated.includes(fCreated) ||
            fCreated.includes(sCreated) ||
            (sCreated.replace(/@.*$/, '') === fCreated.replace(/@.*$/, ''))
          );
          if (!creatorMatch) return false;

          // Cek tanggal apakah bertentangan
          if (!datesCompatible(it.maintenanceTime, f.findingDate)) return false;

          // 3. Unit / Specific Detail matching
          const fSpec = normalize(f.specificDetail);
          const fPart = normalize(f.partName);

          if (sSpec && fSpec && (sSpec === fSpec || sSpec.includes(fSpec) || fSpec.includes(sSpec))) return true;
          if (sSpec && fPart && (sSpec === fPart || sSpec.includes(fPart) || fPart.includes(sSpec))) return true;

          // 4. Maintenance name matching
          const fMaint = normalize(f.maintenanceName);
          if (sMaint && fMaint && (sMaint === fMaint || sMaint.includes(fMaint) || fMaint.includes(sMaint))) {
            if (sSpec && fSpec && sSpec !== fSpec && !sSpec.includes(fSpec) && !fSpec.includes(sSpec)) {
              return false;
            }
            return true;
          }

          return false;
        });

        if (matched) {
          matchedFindingIds.add(matched.id);

          const hasOwnPhoto = Boolean(
            it.abnormalFinding?.photoBase64 || 
            (it.abnormalFinding?.photos && it.abnormalFinding.photos.length > 0)
          );

          // PENTING: Hanya ambil foto dari finding jika dokumen asli belum ada foto dan finding memiliki foto
          const matchedPhoto = (matched.photos && matched.photos[0]?.base64) || matched.photoBase64 || '';
          const realPhoto = hasOwnPhoto
            ? (it.abnormalFinding?.photoBase64 || (it.abnormalFinding?.photos && it.abnormalFinding.photos[0]?.base64) || '')
            : matchedPhoto;

          const realPhotos = hasOwnPhoto
            ? (it.abnormalFinding?.photos && it.abnormalFinding.photos.length > 0 
                ? it.abnormalFinding.photos 
                : (it.abnormalFinding?.photoBase64 ? [{ base64: it.abnormalFinding.photoBase64, description: 'Bukti Temuan Abnormal' }] : []))
            : (matched.photos && matched.photos.length > 0
                ? matched.photos
                : (matchedPhoto ? [{ base64: matchedPhoto, description: 'Bukti Temuan Abnormal' }] : []));

          // Ambil deskripsi dan rekomendasi yang diinputkan oleh teknisi
          const realDesc = (isGenericFallback ? (matched.remark || matched.description || (matched.partName ? `Temuan abnormal pada: ${matched.partName}` : '')) : currentDesc) 
            || matched.remark 
            || matched.description 
            || currentDesc;
          const realReco = it.abnormalFinding?.actionRecommendation 
            || matched.actionRecommendation 
            || (matched.partName ? `Perlu perbaikan / penggantian ${matched.partName}${matched.brandName ? ` (${matched.brandName})` : ''}` : '');

          const realPartName = it.abnormalFinding?.partName || matched.partName || it.partName;
          const realPartNumber = it.abnormalFinding?.partNumber || matched.partNumber || it.partNumber;
          const realBrandName = it.abnormalFinding?.brandName || matched.brandName || it.brandName;
          const realQuantity = it.abnormalFinding?.quantity || matched.quantity || it.quantity;

          return {
            ...it,
            findingId: matched.id,
            partName: realPartName,
            partNumber: realPartNumber,
            brandName: realBrandName,
            quantity: realQuantity,
            abnormalFinding: {
              ...it.abnormalFinding,
              unitName: it.abnormalFinding?.unitName || matched.specificDetail || matched.partName || it.specificDetail || it.maintenanceName,
              description: realDesc || 'Temuan abnormal tercatat pada dokumen ini.',
              actionRecommendation: realReco || undefined,
              photoBase64: realPhoto || undefined,
              photos: realPhotos,
              reportedBy: it.abnormalFinding?.reportedBy || matched.createdByEmail || it.createdBy,
              reportedAt: it.abnormalFinding?.reportedAt || matched.findingDate || it.maintenanceTime,
              partName: realPartName,
              partNumber: realPartNumber,
              brandName: realBrandName,
              quantity: realQuantity,
            }
          };
        }

        return it;
      };

      const enrichedPdf = pdfList.map(enrichItemWithFinding);
      const enrichedExcel = excelList.map(enrichItemWithFinding);
      const enrichedHse = hseList.map(enrichItemWithFinding);

      // Standalone findings: HANYA temuan mandiri tanpa dokumen induk PM (misal dari form input temuan lepas)
      // Jangan pernah melipatgandakan temuan PM yang sudah memiliki dokumen atau dokumennya sudah Normal/dihapus!
      const standaloneFindings: AbnormalItem[] = findingsList
        .filter(f => {
          if (!f || matchedFindingIds.has(f.id)) return false;

          // Jika finding memiliki docId/reportId atau terikat ke dokumen yang sudah dihapus/Normal -> JANGAN tampilkan
          if (f.docId || f.reportId) return false;

          // Jika finding memiliki specificDetail atau maintenanceName PM (dibuat dari form laporan PM),
          // dan akun bersangkutan sudah dikelola lewat dokumen PM, jangan munculkan sisa duplikatnya sebagai unit terpisah
          const fSpec = normalize(f.specificDetail);
          const fMaint = normalize(f.maintenanceName);
          // Input abnormal manual memang menyimpan maintenanceName dan unit secara terpisah.
          // Tandai eksplisit agar tetap tampil, tanpa membuka kembali duplikasi temuan PM lama.
          if (!f.manualAbnormal && (fSpec || (fMaint && fMaint !== 'temuanlapangan' && fMaint !== normalize(f.partName)))) {
            return false;
          }

          return true;
        })
        .map(f => {
          const createdAt = f.createdAt?.toDate ? f.createdAt.toDate() : (f.createdAt ? new Date(f.createdAt) : new Date());
          const photoB64 = (f.photos && f.photos[0]?.base64) || f.photoBase64 || '';
          return {
            id: `finding_${f.id}`,
            docId: f.id,
            findingId: f.id,
            collectionName: 'findings',
            documentType: 'pdf',
            fileName: `Temuan_${f.partName || 'Unit'}.pdf`,
            maintenanceName: f.maintenanceName || f.partName || 'Temuan Lapangan',
            maintenanceTime: f.findingDate || (f.findingMonth && f.findingYear ? `${f.findingYear}-${String(f.findingMonth).padStart(2, '0')}-01` : ''),
            specificDetail: f.specificDetail || f.partName || '',
            createdBy: (f.createdByEmail || 'engineer').toLowerCase().trim(),
            createdAt,
            hasAbnormal: true,
            partName: f.partName,
            partNumber: f.partNumber,
            brandName: f.brandName,
            quantity: f.quantity,
            abnormalFinding: {
              unitName: f.partName || f.specificDetail || 'Unit',
              description: f.remark || f.description || `Temuan abnormal pada: ${f.partName || 'Peralatan'}`,
              actionRecommendation: f.actionRecommendation || (f.partName ? `Perlu perbaikan / penggantian ${f.partName}${f.brandName ? ` (${f.brandName})` : ''}` : ''),
              photoBase64: photoB64 || undefined,
              photos: f.photos || (photoB64 ? [{ base64: photoB64, description: 'Bukti Temuan Abnormal' }] : []),
              reportedBy: f.createdByEmail || 'Engineer',
              reportedAt: f.findingDate || createdAt,
              partName: f.partName,
              partNumber: f.partNumber,
              brandName: f.brandName,
              quantity: f.quantity,
            }
          };
        });

      const combined = [...enrichedPdf, ...enrichedExcel, ...enrichedHse, ...standaloneFindings];
      setItems(combined);
      setSourceCounts({
        documents: pdfList.length + excelList.length + hseList.length,
        findings: findingsList.length,
      });
      setLoading(false);
    };

    // 1. Listen pdf_documents with hasAbnormal == true
    const qPdf = query(collection(db, 'pdf_documents'), where('hasAbnormal', '==', true));
    const unsubPdf = onSnapshot(
      qPdf,
      (snapshot) => {
        pdfList = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
          const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : createdAt);
          return {
            id: `pdf_${d.id}`,
            docId: d.id,
            collectionName: 'pdf_documents',
            documentType: 'pdf',
            fileName: data.fileName || `${data.maintenanceName || 'Laporan'}.pdf`,
            maintenanceName: data.maintenanceName || 'Maintenance',
            maintenanceTime: data.maintenanceTime || '',
            specificDetail: data.specificDetail || '',
            companyType: data.companyType,
            createdBy: (data.createdBy || 'engineer').toLowerCase().trim(),
            createdAt,
            updatedAt,
            hasAbnormal: true,
            abnormalFinding: data.abnormalFinding || {
              unitName: data.specificDetail || data.maintenanceName || 'Unit',
              description: 'Temuan abnormal tercatat pada dokumen ini.'
            },
            attachedSrFile: data.attachedSrFile,
            attachedSrBase64: data.attachedSrBase64,
            hasPredictiveReport: Boolean(data.hasPredictiveReport),
            predictiveReportId: data.predictiveReportId,
            predictiveReportNumber: data.predictiveReportNumber,
            predictiveHealthStatus: data.predictiveHealthStatus,
            predictiveRemainingLife: data.predictiveRemainingLife,
          };
        });
        updateAll();
      },
      (err) => {
        console.error('Error listening pdf abnormal documents:', err);
        setLoading(false);
      }
    );

    // 2. Listen excel_documents with hasAbnormal == true
    const qExcel = query(collection(db, 'excel_documents'), where('hasAbnormal', '==', true));
    const unsubExcel = onSnapshot(
      qExcel,
      (snapshot) => {
        excelList = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
          const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : createdAt);
          return {
            id: `excel_${d.id}`,
            docId: d.id,
            collectionName: 'excel_documents',
            documentType: 'excel',
            fileName: data.fileName || `${data.maintenanceName || 'Laporan'}.xlsx`,
            maintenanceName: data.maintenanceName || 'Maintenance',
            maintenanceTime: data.maintenanceTime || '',
            specificDetail: data.specificDetail || '',
            companyType: data.companyType,
            createdBy: (data.createdBy || 'engineer').toLowerCase().trim(),
            createdAt,
            updatedAt,
            hasAbnormal: true,
            abnormalFinding: data.abnormalFinding || {
              unitName: data.specificDetail || data.maintenanceName || 'Unit',
              description: 'Temuan abnormal tercatat pada dokumen ini.'
            },
            attachedSrFile: data.attachedSrFile,
            attachedSrBase64: data.attachedSrBase64,
            hasPredictiveReport: Boolean(data.hasPredictiveReport),
            predictiveReportId: data.predictiveReportId,
            predictiveReportNumber: data.predictiveReportNumber,
            predictiveHealthStatus: data.predictiveHealthStatus,
            predictiveRemainingLife: data.predictiveRemainingLife,
          };
        });
        updateAll();
      },
      (err) => {
        console.error('Error listening excel abnormal documents:', err);
        setLoading(false);
      }
    );

    // 3. Listen hse with hasAbnormal == true
    const qHse = query(collection(db, 'hse'), where('hasAbnormal', '==', true));
    const unsubHse = onSnapshot(
      qHse,
      (snapshot) => {
        hseList = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
          const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : createdAt);
          return {
            id: `hse_${d.id}`,
            docId: d.id,
            collectionName: 'hse',
            documentType: 'hse',
            fileName: `HSE_${data.aktivitas || 'Inspeksi'}_${data.date || ''}.pdf`,
            maintenanceName: data.aktivitas || 'Inspeksi HSE',
            maintenanceTime: data.date || '',
            specificDetail: data.lokasi || '',
            createdBy: (data.authorEmail || 'hse').toLowerCase().trim(),
            createdAt,
            updatedAt,
            hasAbnormal: true,
            abnormalFinding: data.abnormalFinding || {
              unitName: data.lokasi || data.aktivitas || 'HSE Area',
              description: 'Temuan abnormal tercatat pada dokumen HSE ini.'
            },
          };
        });
        updateAll();
      },
      (err) => {
        console.error('Error listening hse abnormal documents:', err);
        setLoading(false);
      }
    );

    // 4. Listen koleksi findings untuk temuan detail yang diinputkan teknisi
    const qFindings = query(collection(db, 'findings'));
    const unsubFindings = onSnapshot(
      qFindings,
      (snapshot) => {
        findingsList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        updateAll();
      },
      (err) => {
        console.error('Error listening findings collection:', err);
      }
    );

    return () => {
      unsubPdf();
      unsubExcel();
      unsubHse();
      unsubFindings();
    };
  }, []);

  // Daftar akun engineer unik yang memiliki temuan abnormal
  const uniqueAccounts = useMemo(() => {
    const setAcc = new Set<string>();
    items.forEach((it) => {
      if (it.createdBy) setAcc.add(it.createdBy);
    });
    return Array.from(setAcc).sort();
  }, [items]);

  // Jumlah temuan per akun (untuk badge & label di dropdown akun)
  const accountStatsMap = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      if (it.createdBy) {
        map.set(it.createdBy, (map.get(it.createdBy) || 0) + 1);
      }
    });
    return map;
  }, [items]);

  // Menghitung jumlah filter aktif
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedMonthFilter !== 'all') count++;
    if (selectedAccountFilter !== 'all') count++;
    if (selectedDocTypeFilter !== 'all') count++;
    if (selectedPhotoFilter !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [searchQuery, selectedMonthFilter, selectedAccountFilter, selectedDocTypeFilter, selectedPhotoFilter, sortBy]);

  // Handler reset semua filter
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMonthFilter('all');
    setSelectedAccountFilter('all');
    setSelectedDocTypeFilter('all');
    setSelectedPhotoFilter('all');
    setSortBy('newest');
  };

  // Daftar bulan unik yang tersedia dari data temuan abnormal
  const availableMonths = useMemo(() => {
    const map = new Map<string, { key: string; label: string; date: Date; count: number }>();
    items.forEach((it) => {
      const m = getItemMonthData(it);
      if (!map.has(m.key)) {
        map.set(m.key, { ...m, count: 1 });
      } else {
        map.get(m.key)!.count++;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [items]);

  // Penyaringan & Pengurutan data temuan abnormal
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      // Filter Periode Bulan
      if (selectedMonthFilter !== 'all') {
        const m = getItemMonthData(item);
        if (m.key !== selectedMonthFilter) return false;
      }

      // Filter Akun
      if (selectedAccountFilter !== 'all' && item.createdBy !== selectedAccountFilter) {
        return false;
      }

      // Filter Tipe Dokumen
      if (selectedDocTypeFilter !== 'all' && item.documentType !== selectedDocTypeFilter) {
        return false;
      }

      // Filter Keberadaan Foto
      const hasPhoto = Boolean(item.abnormalFinding?.photoBase64);
      if (selectedPhotoFilter === 'with_photo' && !hasPhoto) return false;
      if (selectedPhotoFilter === 'without_photo' && hasPhoto) return false;

      // Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const uName = (item.abnormalFinding?.unitName || '').toLowerCase();
        const desc = (item.abnormalFinding?.description || '').toLowerCase();
        const reco = (item.abnormalFinding?.actionRecommendation || '').toLowerCase();
        const reporter = (item.abnormalFinding?.reportedBy || '').toLowerCase();
        const acc = item.createdBy.toLowerCase();
        const mName = item.maintenanceName.toLowerCase();
        const sDetail = (item.specificDetail || '').toLowerCase();

        return (
          uName.includes(q) ||
          desc.includes(q) ||
          reco.includes(q) ||
          reporter.includes(q) ||
          acc.includes(q) ||
          mName.includes(q) ||
          sDetail.includes(q)
        );
      }

      return true;
    });

    // Pengurutan
    return result.sort((a, b) => {
      if (sortBy === 'unit_asc') {
        const nameA = (a.abnormalFinding?.unitName || a.specificDetail || a.maintenanceName).toLowerCase();
        const nameB = (b.abnormalFinding?.unitName || b.specificDetail || b.maintenanceName).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'oldest') {
        const timeA = a.updatedAt?.getTime() || a.createdAt.getTime();
        const timeB = b.updatedAt?.getTime() || b.createdAt.getTime();
        return timeA - timeB;
      }
      // default: newest
      const timeA = a.updatedAt?.getTime() || a.createdAt.getTime();
      const timeB = b.updatedAt?.getTime() || b.createdAt.getTime();
      return timeB - timeA;
    });
  }, [items, selectedMonthFilter, selectedAccountFilter, selectedDocTypeFilter, selectedPhotoFilter, searchQuery, sortBy]);

  // Rentang ini khusus data yang diunduh sebagai rekap; filter daftar di layar
  // tetap dapat dipakai bersamaan bila QC perlu mempersempit lagi per akun/tipe.
  const recapItems = useMemo(() => filteredItems.filter((item) => {
    const monthKey = getItemMonthData(item).key;
    if (recapStartMonth !== 'all' && monthKey < recapStartMonth) return false;
    if (recapEndMonth !== 'all' && monthKey > recapEndMonth) return false;
    return true;
  }), [filteredItems, recapStartMonth, recapEndMonth]);

  const recapPeriodLabel = useMemo(() => {
    const start = availableMonths.find((month) => month.key === recapStartMonth);
    const end = availableMonths.find((month) => month.key === recapEndMonth);
    if (start && end) return `${start.label} s.d. ${end.label}`;
    if (start) return `Mulai ${start.label}`;
    if (end) return `Sampai ${end.label}`;
    const activeMonth = availableMonths.find((month) => month.key === selectedMonthFilter);
    return activeMonth?.label || 'Semua Periode';
  }, [availableMonths, recapStartMonth, recapEndMonth, selectedMonthFilter]);

  // Statistik KPI
  const stats = useMemo(() => {
    const total = items.length;
    const withPhoto = items.filter((i) => Boolean(i.abnormalFinding?.photoBase64)).length;
    const withReco = items.filter((i) => Boolean(i.abnormalFinding?.actionRecommendation?.trim())).length;
    const totalAccounts = uniqueAccounts.length;
    return { total, withPhoto, withReco, totalAccounts };
  }, [items, uniqueAccounts]);

  // Handler: Tandai Normal (QC Approval & Resolve)
  const handleMarkNormal = async () => {
    if (!confirmNormalItem) return;

    setIsProcessingNormal(true);
    const toastId = toast.loading(`Mengembalikan unit "${confirmNormalItem.abnormalFinding?.unitName || confirmNormalItem.maintenanceName}" ke status Normal...`);

    try {
      if (confirmNormalItem.collectionName === 'findings') {
        await deleteDoc(doc(db, 'findings', confirmNormalItem.docId));
      } else {
        await updateDoc(doc(db, confirmNormalItem.collectionName, confirmNormalItem.docId), {
          hasAbnormal: false,
          abnormalFinding: deleteField(),
          updatedAt: serverTimestamp(),
        });
        await offlineReportStorage.updateReportAbnormal(confirmNormalItem.docId, false, null);
        if (confirmNormalItem.findingId) {
          await deleteDoc(doc(db, 'findings', confirmNormalItem.findingId)).catch(() => {});
        }
      }

      toast.success(`Unit berhasil ditandai Normal. Temuan abnormal telah diselesaikan oleh QC DME!`, { id: toastId });
      setConfirmNormalItem(null);
    } catch (err: any) {
      console.error('Error marking unit normal from QC DME:', err);
      toast.error(`Gagal menandai normal: ${err.message || 'Kesalahan jaringan'}`, { id: toastId });
    } finally {
      setIsProcessingNormal(false);
    }
  };

  // Handler: Download PDF Dokumen Lengkap dengan Lampiran Temuan Abnormal
  const handleDownloadReportPDF = async (item: AbnormalItem) => {
    const toastId = toast.loading('Membuat berkas PDF resmi beserta lembar temuan abnormal...');
    try {
      // Ambil foto laporan dari subkoleksi atau IndexedDB
      let photosData: any[] = [];
      try {
        const offlinePhotos = await offlineReportStorage.getPhotos(item.docId);
        if (offlinePhotos && offlinePhotos.length > 0) {
          photosData = offlinePhotos;
        } else {
          const subCol = item.documentType === 'excel' ? 'excel_documents' : 'pdf_documents';
          const snap = await getDocs(collection(db, `${subCol}/${item.docId}/photos`));
          if (!snap.empty) {
            photosData = snap.docs.map((d) => d.data()).sort((a: any, b: any) => a.index - b.index);
          }
        }
      } catch (e) {
        console.warn('Gagal memuat foto detail:', e);
      }

      const cards = photosData.map((p, i) => ({
        id: `abnormal_${i}`,
        photo: null as File | null,
        photoBase64: p.photoBase64 || '',
        description: p.description || '',
      }));

      const effCompany = item.companyType || companyType || 'neutra';
      const leftLogo = effCompany === 'bri' ? logoBRILeft : logoDwimitra;
      const rightLogo = effCompany === 'bri' ? logoBRI : effCompany === 'k2' ? logoK2 : logoNeutraDC;
      const [logoLeftB64, logoRightB64] = await Promise.all([
        loadLogoBase64(leftLogo),
        loadLogoBase64(rightLogo),
      ]);

      const docResult = await generateReportPDF({
        maintenanceName: item.maintenanceName,
        maintenanceTime: item.maintenanceTime,
        specificDetail: item.specificDetail || '',
        vrvUnitDetail: '',
        cards,
        companyType: effCompany as 'neutra' | 'bri' | 'k2',
        userEmail: item.createdBy,
        logos: { left: logoLeftB64, right: logoRightB64 },
        abnormalFinding: {
          partName: item.partName || item.abnormalFinding?.partName || item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName,
          partNumber: item.partNumber || item.abnormalFinding?.partNumber || '-',
          brandName: item.brandName || item.abnormalFinding?.brandName || '-',
          quantity: item.quantity ? `${item.quantity}` : (item.abnormalFinding?.quantity ? `${item.abnormalFinding.quantity}` : '1 Unit'),
          findingDate: item.abnormalFinding?.findingDate || (item.abnormalFinding?.reportedAt
            ? (typeof item.abnormalFinding.reportedAt === 'string'
                ? item.abnormalFinding.reportedAt.split('T')[0]
                : new Date(item.abnormalFinding.reportedAt).toLocaleDateString('id-ID'))
            : item.maintenanceTime),
          remark: item.abnormalFinding?.description || 'Temuan abnormal tercatat pada dokumen ini.',
          actionRecommendation: item.abnormalFinding?.actionRecommendation || undefined,
          photos: (item.abnormalFinding?.photos && item.abnormalFinding.photos.length > 0)
            ? item.abnormalFinding.photos
            : (item.abnormalFinding?.photoBase64 ? [{ base64: item.abnormalFinding.photoBase64, description: 'Bukti Temuan Abnormal' }] : [])
        }
      });

      if (!docResult) throw new Error('Gagal menghasilkan dokumen PDF.');

      const safeName = item.fileName.replace(/\.pdf$/i, '').replace(/[/\\?%*:|"<>]/g, '_');
      docResult.doc.save(`${safeName}_Lengkap_Abnormal.pdf`);
      toast.success('Berkas PDF resmi berhasil diunduh!', { id: toastId });
    } catch (err: any) {
      console.error('Error exporting PDF abnormal report:', err);
      toast.error(`Gagal mengekspor PDF: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  // Handler: Ekspor Rekap Lengkap Temuan Abnormal ke format Microsoft Word (.DOCX)
  const handleExportWordRecap = async () => {
    if (recapStartMonth !== 'all' && recapEndMonth !== 'all' && recapStartMonth > recapEndMonth) {
      toast.error('Bulan awal rekap tidak boleh setelah bulan akhir.');
      return;
    }
    if (recapItems.length === 0) {
      toast.error('Tidak ada data temuan abnormal yang sesuai untuk diekspor.');
      return;
    }

    const toastId = toast.loading('Menyusun dokumen Word (.docx) rekap temuan abnormal...');
    try {
      const printedBy = `${user?.email || 'Quality Control DME'} (QC DME)`;

      await exportAbnormalRecapToWord(recapItems, {
        periodLabel: recapPeriodLabel,
        printedBy,
      });

      toast.success('Dokumen Word rekap temuan abnormal berhasil diunduh!', { id: toastId });
    } catch (err: any) {
      console.error('Error exporting Word recap:', err);
      toast.error(`Gagal membuat rekap Word: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  // Handler: Ekspor Rekap Excel Temuan Abnormal ke format .XLSX
  const handleExportExcelRecap = async () => {
    if (recapStartMonth !== 'all' && recapEndMonth !== 'all' && recapStartMonth > recapEndMonth) {
      toast.error('Bulan awal rekap tidak boleh setelah bulan akhir.');
      return;
    }
    if (recapItems.length === 0) {
      toast.error('Tidak ada data temuan abnormal yang sesuai untuk diekspor.');
      return;
    }

    const periodLabel = recapPeriodLabel;

    const toastId = toast.loading('Menyusun spreadsheet rekap temuan abnormal...');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'QC DME - PT Dwimitra Ekatama Mandiri';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Rekap Temuan Abnormal');

      // Title & Header Information
      worksheet.mergeCells('A1:I1');
      worksheet.getCell('A1').value = `REKAPITULASI TEMUAN KONDISI ABNORMAL MAINTENANCE DATA CENTER (${periodLabel.toUpperCase()})`;
      worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF991B1B' } };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 28;

      worksheet.mergeCells('A2:I2');
      worksheet.getCell('A2').value = `Dicetak oleh: ${user?.email || 'QC DME'} | Periode: ${periodLabel} | Tanggal Rekap: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;
      worksheet.getCell('A2').font = { size: 10, italic: true, color: { argb: 'FF475569' } };
      worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 18;

      worksheet.addRow([]); // Blank line

      // Table Header
      const headerRow = worksheet.addRow([
        'No',
        'Akun Maintenance',
        'Nama Unit / Peralatan',
        'Laporan Pemeliharaan',
        'Tanggal Pelaksanaan',
        'Deskripsi Kerusakan / Abnormal',
        'Rekomendasi / Tindakan',
        'Foto Bukti',
        'Pelapor'
      ]);

      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF991B1B' } // Dark Red
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      // Data Rows
      recapItems.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.createdBy,
          item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName,
          item.maintenanceName,
          formatWaktuMaintenance(item),
          item.abnormalFinding?.description || '-',
          item.abnormalFinding?.actionRecommendation || '-',
          item.abnormalFinding?.photoBase64 ? 'Ada (Terlampir)' : 'Tanpa Foto',
          item.abnormalFinding?.reportedBy || item.createdBy
        ]);

        row.height = 26;
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 5 || colNumber === 8 ? 'center' : 'left',
            wrapText: true
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          cell.font = { size: 9 };
        });
      });

      // Column widths
      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 24;
      worksheet.getColumn(3).width = 28;
      worksheet.getColumn(4).width = 30;
      worksheet.getColumn(5).width = 18;
      worksheet.getColumn(6).width = 40;
      worksheet.getColumn(7).width = 32;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 20;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const cleanPeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
      saveAs(blob, `Rekap_Temuan_Abnormal_QC_DME_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success('Spreadsheet rekap temuan abnormal berhasil diunduh!', { id: toastId });
    } catch (err: any) {
      console.error('Error generating Excel recap:', err);
      toast.error(`Gagal membuat rekap Excel: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Header Bar Khusus QC DME */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/90 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  Pusat Temuan Kondisi Abnormal
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  QC DME
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Monitoring kerusakan & tindak lanjut anomali dari seluruh akun maintenance
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" title="Rentang bulan khusus data rekap yang diekspor">
              <span className="hidden lg:inline px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rekap</span>
              <select
                value={recapStartMonth}
                onChange={(event) => setRecapStartMonth(event.target.value)}
                className="max-w-[128px] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none"
                aria-label="Bulan awal rekap abnormal"
              >
                <option value="all">Dari semua bulan</option>
                {availableMonths.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
              </select>
              <span className="text-[11px] text-slate-400">s.d.</span>
              <select
                value={recapEndMonth}
                onChange={(event) => setRecapEndMonth(event.target.value)}
                className="max-w-[128px] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none"
                aria-label="Bulan akhir rekap abnormal"
              >
                <option value="all">Sampai semua bulan</option>
                {availableMonths.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExportWordRecap}
              disabled={recapItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
              title="Unduh Rekap Lengkap Word (.docx) dengan Detail & Foto Bukti"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ekspor Word</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcelRecap}
              disabled={recapItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
              title="Unduh Rekap Spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        {/* Compact KPI Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-rose-50/60 border border-rose-100">
            <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-rose-600 tracking-wider">Total Ditampilkan</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{stats.total} <span className="text-[11px] font-normal text-slate-500">Laporan</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <div className="w-7 h-7 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-slate-600 tracking-wider">Dokumen Abnormal</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{sourceCounts.documents} <span className="text-[11px] font-normal text-slate-500">Dokumen</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-violet-50/60 border border-violet-100">
            <div className="w-7 h-7 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-violet-700 tracking-wider">Record Findings</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{sourceCounts.findings} <span className="text-[11px] font-normal text-slate-500">Record</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-100">
            <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-amber-700 tracking-wider">Akun Terlibat</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{stats.totalAccounts} <span className="text-[11px] font-normal text-slate-500">Akun</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
            <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-emerald-700 tracking-wider">Dengan Foto</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{stats.withPhoto} <span className="text-[11px] font-normal text-slate-500">Unit</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100">
            <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-blue-700 tracking-wider">Rekomendasi</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{stats.withReco} <span className="text-[11px] font-normal text-slate-500">Item</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar Filter & View Controls */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs space-y-3">
        {/* Row 1: Search Box & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box - Lega & Responsif */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari unit, kendala kerusakan, dokumen, pelapor, akun..."
              className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-slate-800 placeholder-slate-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Hapus kata kunci pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls: View Switcher (Grid vs Table) + Reset */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Kartu Ringkas"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-[11px]">Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Tabel Rapat (Cepat Triage)"
              >
                <List className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px]">Tabel</span>
              </button>
            </div>

            {/* Reset Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Reset Semua Filter"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline text-[11px]">Reset</span>
                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {activeFiltersCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Filter Grid Terstruktur */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-slate-100">
          {/* Filter Akun Maintenance */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Akun Maintenance
            </label>
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 transition cursor-pointer truncate"
            >
              <option value="all">Semua Akun ({uniqueAccounts.length} akun • {items.length} temuan)</option>
              {uniqueAccounts.map((acc) => {
                const countAcc = accountStatsMap.get(acc) || 0;
                return (
                  <option key={acc} value={acc}>
                    {acc.replace(/@.+$/, '')} ({countAcc} temuan)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter Periode Bulan */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Periode Bulan
            </label>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 transition cursor-pointer truncate"
            >
              <option value="all">Semua Bulan ({items.length})</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tipe Dokumen */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Tipe Dokumen
            </label>
            <select
              value={selectedDocTypeFilter}
              onChange={(e) => setSelectedDocTypeFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 transition cursor-pointer truncate"
            >
              <option value="all">Semua Tipe</option>
              <option value="pdf">PDF (PM Rutin)</option>
              <option value="excel">Excel (Full)</option>
              <option value="hse">HSE (Inspeksi)</option>
            </select>
          </div>

          {/* Filter Foto */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status Foto
            </label>
            <select
              value={selectedPhotoFilter}
              onChange={(e) => setSelectedPhotoFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 transition cursor-pointer truncate"
            >
              <option value="all">Semua Foto</option>
              <option value="with_photo">Hanya Berfoto ({stats.withPhoto})</option>
              <option value="without_photo">Tanpa Foto ({items.length - stats.withPhoto})</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Urutkan Berdasarkan
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 transition cursor-pointer truncate"
            >
              <option value="newest">Waktu Terkini</option>
              <option value="oldest">Waktu Terlama</option>
              <option value="unit_asc">Nama Unit (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Row 3: Active Filter Badges (Pills) */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Filter Aktif:
            </span>

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                <span>Cari: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-600 cursor-pointer ml-0.5"
                  title="Hapus filter cari"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedAccountFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-medium border border-rose-200">
                <span>Akun: {selectedAccountFilter.replace(/@.+$/, '')}</span>
                <button
                  type="button"
                  onClick={() => setSelectedAccountFilter('all')}
                  className="hover:text-rose-900 cursor-pointer ml-0.5"
                  title="Hapus filter akun"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedMonthFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-200">
                <span>
                  Bulan: {availableMonths.find((m) => m.key === selectedMonthFilter)?.label || selectedMonthFilter}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMonthFilter('all')}
                  className="hover:text-blue-900 cursor-pointer ml-0.5"
                  title="Hapus filter bulan"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedDocTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">
                <span>Tipe: {selectedDocTypeFilter.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDocTypeFilter('all')}
                  className="hover:text-amber-900 cursor-pointer ml-0.5"
                  title="Hapus filter tipe"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedPhotoFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                <span>{selectedPhotoFilter === 'with_photo' ? 'Hanya Berfoto' : 'Tanpa Foto'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPhotoFilter('all')}
                  className="hover:text-emerald-900 cursor-pointer ml-0.5"
                  title="Hapus filter foto"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {sortBy !== 'newest' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-200">
                <span>Urut: {sortBy === 'oldest' ? 'Waktu Terlama' : 'Unit (A-Z)'}</span>
                <button
                  type="button"
                  onClick={() => setSortBy('newest')}
                  className="hover:text-purple-900 cursor-pointer ml-0.5"
                  title="Kembalikan urutan default"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
            >
              Hapus Semua Filter
            </button>
          </div>
        )}
      </div>

      {canDelete && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-rose-900">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">Mode pilih hapus QC DME</span>
            <span className="text-rose-700">{selectedDeleteIds.size} data dipilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              {filteredItems.length > 0 && filteredItems.every((item) => selectedDeleteIds.has(item.id)) ? 'Batal Pilih Semua' : 'Pilih Semua Hasil'}
            </button>
            <button
              type="button"
              disabled={selectedDeleteIds.size === 0}
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih
            </button>
          </div>
        </div>
      )}

      {/* Konten Utama Daftar Temuan Abnormal */}
      {loading ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 text-rose-600 animate-spin mb-2.5" />
          <p className="text-xs font-bold text-slate-700">Memuat data temuan abnormal seluruh akun...</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Menyinkronkan status dari Cloud Firestore</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-2.5">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {items.length === 0
                ? 'Semua Peralatan Beroperasi Normal'
                : 'Tidak Ada Temuan yang Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-0.5 leading-relaxed">
              {items.length === 0
                ? 'Tidak ada laporan dengan status kondisi abnormal yang tercatat pada seluruh akun maintenance saat ini.'
                : 'Coba ubah kata kunci pencarian atau sesuaikan pilihan filter di atas.'}
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 mx-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Dense Table View: Cepat Triage & Minimal Scrolling */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-10">
                    {canDelete ? (
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && filteredItems.every((item) => selectedDeleteIds.has(item.id))}
                        onChange={toggleSelectAllFiltered}
                        className="h-3.5 w-3.5 accent-rose-600 cursor-pointer"
                        aria-label="Pilih semua data temuan yang tampil"
                      />
                    ) : '#'}
                  </th>
                  <th className="py-2.5 px-3 w-14 text-center">Foto</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Unit & Laporan</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Deskripsi Kelainan</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Rekomendasi</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Pelapor & Waktu</th>
                  <th className="py-2.5 px-3 text-right min-w-[220px]">Aksi QC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const abnormal = item.abnormalFinding;
                  const targetUnit = abnormal.unitName || item.specificDetail || item.maintenanceName;
                  const hasPhoto = Boolean(abnormal.photoBase64);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* # Index */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                        {canDelete ? (
                          <input
                            type="checkbox"
                            checked={selectedDeleteIds.has(item.id)}
                            onChange={() => toggleDeleteSelection(item.id)}
                            className="h-3.5 w-3.5 accent-rose-600 cursor-pointer"
                            aria-label={`Pilih ${targetUnit} untuk dihapus`}
                          />
                        ) : idx + 1}
                      </td>

                      {/* Foto Thumbnail */}
                      <td className="py-2.5 px-3 text-center">
                        {hasPhoto ? (
                          <div
                            onClick={() => setPreviewPhoto({
                              src: abnormal.photoBase64!,
                              title: targetUnit,
                              unit: targetUnit,
                              account: item.createdBy,
                              item
                            })}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer mx-auto relative group/thumb hover:scale-105 transition-transform"
                            title="Klik untuk memperbesar foto"
                          >
                            <img
                              src={abnormal.photoBase64}
                              alt={targetUnit}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center mx-auto text-slate-300" title="Tanpa foto">
                            <Camera className="w-4 h-4" />
                          </div>
                        )}
                      </td>

                      {/* Unit & Laporan */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 group-hover:text-rose-950 transition-colors">
                          {targetUnit}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {item.documentType.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            {item.maintenanceName}
                          </span>
                        </div>
                      </td>

                      {/* Deskripsi Kelainan */}
                      <td className="py-2.5 px-3">
                        <div
                          onClick={() => setViewingDetailItem(item)}
                          className="text-slate-800 font-medium line-clamp-2 cursor-pointer hover:text-rose-700 transition"
                          title="Klik untuk melihat detail lengkap"
                        >
                          {abnormal.description || 'Tidak ada deskripsi rinci.'}
                        </div>
                      </td>

                      {/* Rekomendasi */}
                      <td className="py-2.5 px-3">
                        {abnormal.actionRecommendation ? (
                          <div className="text-[11px] text-amber-900 bg-amber-50/70 border border-amber-200/80 rounded px-2 py-1 line-clamp-2">
                            {abnormal.actionRecommendation}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                            className="text-[11px] text-slate-400 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <PenTool className="w-3 h-3" /> + Isi Rekomendasi
                          </button>
                        )}
                      </td>

                      {/* Pelapor & Waktu */}
                      <td className="py-2.5 px-3 text-slate-500">
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[110px]">{item.createdBy.replace(/@.+$/, '')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{formatWaktuMaintenance(item)}</span>
                        </div>
                      </td>

                      {/* Aksi QC */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setViewingDetailItem(item)}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-md transition cursor-pointer"
                            title="Lihat Detail Temuan"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPredictiveModal(item)}
                            disabled={isLoadingPredictive && activePredictiveItem?.id === item.id}
                            className={`p-1.5 rounded-md transition cursor-pointer ${
                              item.hasPredictiveReport || item.predictiveReportId
                                ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                            }`}
                            title="Analisis AI Predictive Maintenance (PdM)"
                          >
                            {isLoadingPredictive && activePredictiveItem?.id === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                            ) : (
                              <Brain className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadReportPDF(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition cursor-pointer"
                            title="Unduh PDF Resmi"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md transition cursor-pointer"
                            title="Edit / Lengkapi Temuan"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmNormalItem(item)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Tandai unit sudah normal kembali"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Normal</span>
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetItem(item)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer"
                              title="Hapus Temuan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Compact Grid Cards: Side-by-Side & Space Efficient */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5">
          {filteredItems.map((item) => {
            const abnormal = item.abnormalFinding;
            const targetUnit = abnormal.unitName || item.specificDetail || item.maintenanceName;
            const hasPhoto = Boolean(abnormal.photoBase64);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-rose-200 transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Header Card */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5" /> ABNORMAL
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-white text-slate-700 border border-slate-200 shrink-0">
                      {item.documentType.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 truncate flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{item.createdBy.replace(/@.+$/, '')}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 shrink-0">
                    {canDelete && (
                      <input
                        type="checkbox"
                        checked={selectedDeleteIds.has(item.id)}
                        onChange={() => toggleDeleteSelection(item.id)}
                        className="h-3.5 w-3.5 accent-rose-600 cursor-pointer"
                        aria-label={`Pilih ${targetUnit} untuk dihapus`}
                      />
                    )}
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatWaktuMaintenance(item)}</span>
                  </div>
                </div>

                {/* Body Card: Side-by-Side Layout */}
                <div className="p-3 sm:p-3.5 flex items-start gap-3">
                  {/* Photo Thumbnail on Left */}
                  {hasPhoto ? (
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 group/photo">
                      <img
                        src={abnormal.photoBase64}
                        alt={targetUnit}
                        className="w-full h-full object-cover cursor-pointer group-hover/photo:scale-105 transition-transform"
                        onClick={() => setPreviewPhoto({
                          src: abnormal.photoBase64!,
                          title: targetUnit,
                          unit: targetUnit,
                          account: item.createdBy,
                          item
                        })}
                      />
                      <div
                        onClick={() => setPreviewPhoto({
                          src: abnormal.photoBase64!,
                          title: targetUnit,
                          unit: targetUnit,
                          account: item.createdBy,
                          item
                        })}
                        className="absolute inset-0 bg-black/35 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[10px] font-semibold gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Perbesar</span>
                      </div>
                      <div className="absolute bottom-1 right-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutoCropText(item);
                          }}
                          className="p-1 bg-white/90 hover:bg-white text-indigo-700 rounded shadow-xs text-[9px] font-bold cursor-pointer"
                          title="Potong otomatis teks"
                        >
                          <Scissors className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCropItem(item);
                          }}
                          className="p-1 bg-white/90 hover:bg-white text-slate-700 rounded shadow-xs text-[9px] font-bold cursor-pointer"
                          title="Crop manual"
                        >
                          <Crop className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0 text-center p-2">
                      <Camera className="w-5 h-5 text-slate-300 mb-1" />
                      <span className="text-[10px] leading-tight">Tanpa foto</span>
                    </div>
                  )}

                  {/* Content on Right */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-950 transition-colors line-clamp-1">
                        {targetUnit}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        Laporan: <span className="text-slate-700">{item.maintenanceName}</span>
                      </p>
                    </div>

                    {/* Deskripsi Kelainan */}
                    <div
                      onClick={() => setViewingDetailItem(item)}
                      className="p-2 bg-rose-50/60 hover:bg-rose-50 border border-rose-100 rounded-lg cursor-pointer transition text-xs text-slate-800 font-medium line-clamp-2"
                      title="Klik untuk melihat detail lengkap di pop-up"
                    >
                      {abnormal.description || 'Tidak ada deskripsi rinci.'}
                    </div>

                    {/* Rekomendasi */}
                    {abnormal.actionRecommendation ? (
                      <div className="text-[11px] text-amber-950 bg-amber-50/70 border border-amber-200/80 rounded-md px-2 py-1 line-clamp-1">
                        <span className="font-semibold text-amber-900">Rekomendasi: </span>
                        {abnormal.actionRecommendation}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                        className="text-[10px] text-slate-400 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <PenTool className="w-2.5 h-2.5" /> + Isi Rekomendasi Tindakan
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewingDetailItem(item)}
                      className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Lihat Detail Lengkap"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Detail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenPredictiveModal(item)}
                      disabled={isLoadingPredictive && activePredictiveItem?.id === item.id}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                        item.hasPredictiveReport || item.predictiveReportId
                          ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80'
                      }`}
                      title="Analisis Predictive Maintenance (PdM)"
                    >
                      {isLoadingPredictive && activePredictiveItem?.id === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                      ) : (
                        <Brain className="w-3 h-3" />
                      )}
                      <span>PdM AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadReportPDF(item)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Unduh Berkas PDF"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Edit / Lengkapi Temuan"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    {onNavigateToDocument && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDocument(item.fileName || item.maintenanceName)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                        title="Buka laporan di arsip dokumen"
                      >
                        <FolderOpen className="w-3 h-3 text-slate-400" />
                        <span>Arsip</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetItem(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Hapus Temuan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmNormalItem(item)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="Tandai unit telah normal kembali"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Normal</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog Konfirmasi Tandai Normal (QC Approval) */}
      <AnimatePresence>
        {confirmNormalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                  <ShieldCheck className="w-6 h-6 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Konfirmasi QC: Tandai Unit Normal
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verifikasi perbaikan peralatan oleh Quality Control DME
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-700">
                <div>
                  <span className="font-bold text-slate-900">Nama Unit: </span>
                  {confirmNormalItem.abnormalFinding?.unitName || confirmNormalItem.specificDetail || confirmNormalItem.maintenanceName}
                </div>
                <div>
                  <span className="font-bold text-slate-900">Akun Pemeliharaan: </span>
                  {confirmNormalItem.createdBy}
                </div>
                <div>
                  <span className="font-bold text-slate-900">Laporan: </span>
                  {confirmNormalItem.maintenanceName}
                </div>
                <div className="pt-1 text-slate-500 text-[11px] leading-relaxed">
                  Apakah kondisi abnormal pada unit ini telah ditindaklanjuti dan diperbaiki? Status dokumen akan kembali menjadi <strong>Normal</strong> pada sistem arsip.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isProcessingNormal}
                  onClick={() => setConfirmNormalItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessingNormal}
                  onClick={handleMarkNormal}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingNormal ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ya, Verifikasi Normal</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Preview Foto Bukti Ukuran Penuh */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            >
              {/* Tombol Tutup X Merah di Pojok Kanan Atas */}
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer hover:rotate-90 duration-200 border border-red-500"
                title="Tutup Preview"
                aria-label="Tutup Preview"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="p-3.5 pr-14 sm:pr-16 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700 flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold truncate text-slate-200">
                    Bukti Temuan Abnormal: {previewPhoto.unit} ({previewPhoto.account})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCropPreviewPhoto}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Potong otomatis bagian atas teks dan hanya tampilkan foto peralatan"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Ambil Foto Saja (Buang Teks)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewPhoto.item) {
                        setEditingCropItem(previewPhoto.item);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Crop manual framing foto ini"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop Manual</span>
                  </button>
                </div>
              </div>

              <div className="p-3 overflow-auto flex items-center justify-center bg-black/90 flex-1 min-h-[300px]">
                <img
                  src={previewPhoto.src}
                  alt={previewPhoto.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                />
              </div>

              {/* Bilah Aksi Bawah Lightbox */}
              <div className="px-4 py-2.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>Foto bukti dokumentasi unit peralatan temuan abnormal.</span>
                <button
                  type="button"
                  onClick={handleCropPreviewPhoto}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer underline"
                >
                  <Scissors className="w-3.5 h-3.5" /> Ambil Foto Saja (Buang Teks)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: LIHAT DETAIL TEMUAN ABNORMAL                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewingDetailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]"
            >
              {/* Header Modal */}
              <div className="bg-gradient-to-r from-rose-700 via-red-600 to-amber-600 px-5 py-4 sm:px-6 sm:py-5 text-white shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shrink-0 border border-white/20">
                      <AlertTriangle className="w-6 h-6 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                          Detail Temuan Abnormal
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/80 text-white border border-rose-300/40 uppercase tracking-wider">
                          Kondisi Abnormal
                        </span>
                      </div>
                      <p className="text-xs text-rose-100/90 mt-0.5 font-medium line-clamp-1">
                        {viewingDetailItem.abnormalFinding?.unitName || viewingDetailItem.specificDetail || viewingDetailItem.maintenanceName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDetailItem(null)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
                    title="Tutup Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body Modal (Scrollable) */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Meta Bar: Akun, Pelapor, Waktu */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Akun / Sistem</span>
                    <span className="font-bold text-slate-700 uppercase truncate block">
                      {viewingDetailItem.createdBy}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Pelapor</span>
                    <span className="font-bold text-slate-700 truncate block">
                      {viewingDetailItem.abnormalFinding?.reportedBy || viewingDetailItem.createdBy}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Waktu Maintenance</span>
                    <span className="font-semibold text-slate-700">
                      {formatWaktuMaintenance(viewingDetailItem)}
                    </span>
                  </div>
                </div>

                {/* Nama Unit Peralatan */}
                <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider block">
                      Nama Unit / Peralatan:
                    </span>
                    <h3 className="text-sm sm:text-base font-black truncate text-white">
                      {viewingDetailItem.abnormalFinding?.unitName || viewingDetailItem.specificDetail || viewingDetailItem.maintenanceName}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold shrink-0 uppercase">
                    {viewingDetailItem.documentType}
                  </span>
                </div>

                {/* Foto Bukti Temuan (Jika Ada) */}
                {viewingDetailItem.abnormalFinding?.photoBase64 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-rose-600" /> Foto Bukti Temuan Abnormal:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAutoCropText(viewingDetailItem)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Potong otomatis bagian atas teks dan hanya simpan bagian foto dokumentasi unit"
                        >
                          <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Ambil Foto Saja (Buang Teks)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCropItem(viewingDetailItem)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Buka pemotong gambar manual"
                        >
                          <Crop className="w-3.5 h-3.5 text-slate-600" />
                          <span>Crop Manual</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 group">
                      <img
                        src={viewingDetailItem.abnormalFinding.photoBase64}
                        alt="Bukti Temuan"
                        className="w-full max-h-72 object-contain mx-auto bg-black/40 cursor-pointer transition group-hover:scale-101"
                        onClick={() => setPreviewPhoto({
                          src: viewingDetailItem.abnormalFinding.photoBase64!,
                          title: viewingDetailItem.abnormalFinding.unitName || 'Temuan Abnormal',
                          unit: viewingDetailItem.abnormalFinding.unitName || viewingDetailItem.maintenanceName,
                          account: viewingDetailItem.createdBy,
                          item: viewingDetailItem
                        })}
                      />
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-300" /> Klik gambar untuk perbesar
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-2 text-slate-400 font-medium">
                      <Camera className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>Belum ada foto bukti temuan terlampir.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingDetailItem;
                        setViewingDetailItem(null);
                        setEditingModalDoc(itemToExcelDoc(target));
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                    >
                      + Tambah Foto
                    </button>
                  </div>
                )}

                {/* Deskripsi Kelainan / Kerusakan */}
                <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Deskripsi Temuan / Kerusakan Abnormal:
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                    {viewingDetailItem.abnormalFinding?.description || 'Tidak ada catatan deskripsi kerusakan.'}
                  </p>
                </div>

                {/* Rekomendasi / Tindakan Lanjutan */}
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" /> Rekomendasi / Tindakan Lanjutan:
                  </span>
                  {viewingDetailItem.abnormalFinding?.actionRecommendation ? (
                    <p className="text-xs sm:text-sm text-amber-950 font-medium leading-relaxed whitespace-pre-line">
                      {viewingDetailItem.abnormalFinding.actionRecommendation}
                    </p>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-amber-800/80 pt-1">
                      <span className="italic">Rekomendasi tindakan belum diisi oleh engineer.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const target = viewingDetailItem;
                          setViewingDetailItem(null);
                          setEditingModalDoc(itemToExcelDoc(target));
                        }}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                      >
                        + Isi Rekomendasi
                      </button>
                    </div>
                  )}
                </div>

                {/* Info File Laporan Induk */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold text-slate-700">
                      {viewingDetailItem.fileName || `${viewingDetailItem.maintenanceName}.pdf`}
                    </span>
                  </div>
                  {viewingDetailItem.attachedSrBase64 && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold shrink-0">
                      + SR Terlampir
                    </span>
                  )}
                </div>
              </div>

              {/* Footer Actions Modal */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingDetailItem;
                      handleOpenPredictiveModal(target);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      viewingDetailItem.hasPredictiveReport || viewingDetailItem.predictiveReportId
                        ? 'bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300'
                    }`}
                    title="Analisis Predictive Maintenance (PdM) berbasis AI"
                  >
                    <Brain className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{viewingDetailItem.hasPredictiveReport || viewingDetailItem.predictiveReportId ? '✓ Lihat Laporan PdM' : 'Predictive AI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingDetailItem;
                      setViewingDetailItem(null);
                      setEditingModalDoc(itemToExcelDoc(target));
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <PenTool className="w-3.5 h-3.5 text-amber-600" />
                    <span>Edit / Lengkapi Temuan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadReportPDF(viewingDetailItem)}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Download PDF</span>
                  </button>

                  {onNavigateToDocument && (
                    <button
                      type="button"
                      onClick={() => {
                        const q = viewingDetailItem.fileName || viewingDetailItem.maintenanceName;
                        setViewingDetailItem(null);
                        onNavigateToDocument(q);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Buka laporan ini di halaman Arsip Dokumen"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Buka di Arsip</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTargetItem(viewingDetailItem)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Hapus data temuan abnormal ini dari sistem"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus Temuan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingDetailItem;
                      setViewingDetailItem(null);
                      setConfirmNormalItem(target);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 border border-emerald-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Tandai unit telah diperbaiki dan kembalikan ke status Normal"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tandai Normal (QC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingDetailItem(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Hapus Banyak Temuan (khusus qcdme@dme.com) */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && canDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                  <Trash2 className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hapus Data Terpilih?</h3>
                  <p className="text-xs text-slate-500">Aksi ini permanen dan hanya tersedia untuk akun QC DME.</p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                Sebanyak <strong className="text-rose-700">{selectedDeleteIds.size} data temuan abnormal</strong> akan dihapus. Untuk dokumen laporan, status abnormal dan data temuannya akan dibersihkan dari sistem.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={handleBulkDeleteAbnormal}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isBulkDeleting ? 'Menghapus...' : `Ya, Hapus ${selectedDeleteIds.size} Data`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Hapus Temuan (khusus qcdme@dme.com) */}
      <AnimatePresence>
        {deleteTargetItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                  <Trash2 className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hapus Data Temuan Abnormal?</h3>
                  <p className="text-xs text-slate-500">Tindakan ini permanen dan akan menghapus status temuan ini.</p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-xs text-slate-700 space-y-1">
                <p>
                  Unit: <strong>{deleteTargetItem.abnormalFinding?.unitName || deleteTargetItem.specificDetail || deleteTargetItem.maintenanceName}</strong>
                </p>
                <p>
                  Laporan: <strong>{deleteTargetItem.fileName || deleteTargetItem.maintenanceName}</strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTargetItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteAbnormal}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Temuan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Edit / Lengkapi Temuan Abnormal */}
      {editingModalDoc && (
        <AbnormalReportModal
          isOpen={!!editingModalDoc}
          onClose={() => setEditingModalDoc(null)}
          document={editingModalDoc}
          onSuccess={(updated) => {
            setItems(prev => prev.map(it => {
              if (it.docId === editingModalDoc.id) {
                return {
                  ...it,
                  hasAbnormal: Boolean(updated.hasAbnormal ?? it.hasAbnormal),
                  abnormalFinding: (updated.abnormalFinding || it.abnormalFinding) as AbnormalFinding
                };
              }
              return it;
            }));
            setEditingModalDoc(null);
          }}
        />
      )}

      {/* Modal ImageEditor untuk Crop Manual Foto Temuan Abnormal */}
      <AnimatePresence>
        {editingCropItem && editingCropItem.abnormalFinding?.photoBase64 && (
          <ImageEditor
            image={editingCropItem.abnormalFinding.photoBase64}
            onSave={handleSaveManualCrop}
            onCancel={() => setEditingCropItem(null)}
            maintenanceName={editingCropItem.abnormalFinding?.unitName || editingCropItem.maintenanceName}
            specificDetail={editingCropItem.abnormalFinding?.description}
          />
        )}
      </AnimatePresence>

      {/* Modal Predictive Maintenance Report (AI Agent) */}
      {predictiveModalOpen && activePredictiveData && (
        <PredictiveReportModal
          isOpen={predictiveModalOpen}
          onClose={() => setPredictiveModalOpen(false)}
          initialData={activePredictiveData}
          isLoadingAI={isLoadingPredictive}
          onRegenerateAI={() => activePredictiveItem ? handleOpenPredictiveModal(activePredictiveItem) : Promise.resolve()}
          onSaved={(saved) => {
            setActivePredictiveData(saved);
            setItems(prev => prev.map(it => {
              if (activePredictiveItem && it.id === activePredictiveItem.id) {
                return {
                  ...it,
                  hasPredictiveReport: true,
                  predictiveReportId: saved.id,
                  predictiveReportNumber: saved.reportNumber,
                  predictiveHealthStatus: saved.healthStatus,
                  predictiveRemainingLife: saved.aiAnalysis.remainingUsefulLife,
                  predictiveReportData: saved,
                };
              }
              return it;
            }));
          }}
        />
      )}
    </div>
  );
}
