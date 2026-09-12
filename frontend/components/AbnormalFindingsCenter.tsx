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
  Crop
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  getDocs
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

export function AbnormalFindingsCenter({ onNavigateToDocument }: AbnormalFindingsCenterProps) {
  const { user, userRole, companyType } = useAuth();
  const canDelete = Boolean(
    user?.email?.toLowerCase() === 'qcdme@dme.com' ||
    userRole === 'qc_dme' ||
    userRole === 'admin'
  );

  const [items, setItems] = useState<AbnormalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState<'all' | 'pdf' | 'excel' | 'hse'>('all');
  const [selectedPhotoFilter, setSelectedPhotoFilter] = useState<'all' | 'with_photo' | 'without_photo'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'unit_asc'>('newest');

  // Preview lightbox photo state
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string; unit: string; account: string; item?: AbnormalItem } | null>(null);

  // Modal konfirmasi tandai normal oleh QC
  const [confirmNormalItem, setConfirmNormalItem] = useState<AbnormalItem | null>(null);
  const [isProcessingNormal, setIsProcessingNormal] = useState(false);

  // Modal konfirmasi hapus temuan oleh QC DME
  const [deleteTargetItem, setDeleteTargetItem] = useState<AbnormalItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal pop-up lihat detail lengkap temuan abnormal
  const [viewingDetailItem, setViewingDetailItem] = useState<AbnormalItem | null>(null);

  // Modal edit / lengkapi temuan abnormal
  const [editingModalDoc, setEditingModalDoc] = useState<ExcelDocument | null>(null);

  // Modal crop foto temuan abnormal (ImageEditor)
  const [editingCropItem, setEditingCropItem] = useState<AbnormalItem | null>(null);

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
    if (!deleteTargetItem) return;
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
          if (fSpec || (fMaint && fMaint !== 'temuanlapangan' && fMaint !== normalize(f.partName))) {
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
            maintenanceTime: f.findingDate || '',
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
    if (filteredItems.length === 0) {
      toast.error('Tidak ada data temuan abnormal yang sesuai untuk diekspor.');
      return;
    }

    const toastId = toast.loading('Menyusun dokumen Word (.docx) rekap temuan abnormal...');
    try {
      const activeMonthObj = availableMonths.find((m) => m.key === selectedMonthFilter);
      const periodLabel = activeMonthObj ? activeMonthObj.label : 'Semua Periode';
      const printedBy = `${user?.email || 'Quality Control DME'} (QC DME)`;

      await exportAbnormalRecapToWord(filteredItems, {
        periodLabel,
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
    if (filteredItems.length === 0) {
      toast.error('Tidak ada data temuan abnormal yang sesuai untuk diekspor.');
      return;
    }

    const activeMonthObj = availableMonths.find((m) => m.key === selectedMonthFilter);
    const periodLabel = activeMonthObj ? activeMonthObj.label : 'Semua Periode';

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
      filteredItems.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.createdBy,
          item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName,
          item.maintenanceName,
          item.maintenanceTime || '-',
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
      {/* Header Banner Khusus QC DME */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-red-950 border border-rose-900/60 shadow-xl text-white p-5 sm:p-7">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-3 sm:p-3.5 bg-gradient-to-br from-rose-600 to-red-700 rounded-2xl text-white shadow-lg border border-rose-400/30 shrink-0">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                  Pusat Temuan Kondisi Abnormal
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/30 text-rose-200 border border-rose-400/40 uppercase tracking-wider">
                  Quality Control DME
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Pengawasan terpadu terhadap seluruh laporan kerusakan, anomali parameter, dan temuan abnormal yang di-upload oleh akun maintenance role engineer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportWordRecap}
              disabled={filteredItems.length === 0}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-blue-400/40"
              title="Unduh Rekap Lengkap Word (.docx) dengan Logo Dwimitra & NeutraDC, Detail & Foto Bukti"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Ekspor Rekap Word (DOCX)</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcelRecap}
              disabled={filteredItems.length === 0}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-emerald-400/40"
              title="Unduh Rekap Spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Ekspor Rekap Excel</span>
            </button>
          </div>
        </div>

        {/* Kartu Statistik KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-6 pt-5 border-t border-rose-900/50">
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] sm:text-[11px] font-bold text-rose-300 uppercase tracking-wider">Total Laporan Abnormal</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.total}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] sm:text-[11px] font-bold text-amber-300 uppercase tracking-wider">Akun Terlibat</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.totalAccounts} <span className="text-xs font-normal text-slate-300">Akun</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Dengan Foto Bukti</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.withPhoto} <span className="text-xs font-normal text-slate-300">Unit</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] sm:text-[11px] font-bold text-blue-300 uppercase tracking-wider">Ada Rekomendasi</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.withReco} <span className="text-xs font-normal text-slate-300">Item</span></p>
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Pencarian */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari unit, kendala, laporan, akun..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition"
            />
          </div>

          {/* Filter Periode Bulan */}
          <div className="relative lg:col-span-1">
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 transition cursor-pointer appearance-none truncate"
            >
              <option value="all">Semua Bulan ({items.length})</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Akun Maintenance */}
          <div className="relative lg:col-span-1">
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold text-slate-800 transition cursor-pointer appearance-none truncate"
            >
              <option value="all">Semua Akun ({uniqueAccounts.length})</option>
              {uniqueAccounts.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tipe Dokumen */}
          <div className="relative lg:col-span-1">
            <select
              value={selectedDocTypeFilter}
              onChange={(e) => setSelectedDocTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition cursor-pointer appearance-none"
            >
              <option value="all">Semua Tipe</option>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="hse">HSE</option>
            </select>
          </div>

          {/* Filter Keberadaan Foto */}
          <div className="relative lg:col-span-1">
            <select
              value={selectedPhotoFilter}
              onChange={(e) => setSelectedPhotoFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition cursor-pointer appearance-none"
            >
              <option value="all">Semua Foto</option>
              <option value="with_photo">Hanya Berfoto</option>
              <option value="without_photo">Tanpa Foto</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pill Buttons (Bulan Rekap Cepat) */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Periode Bulan:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonthFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition cursor-pointer ${
                selectedMonthFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Bulan ({items.length})
            </button>
            {availableMonths.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonthFilter(m.key)}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition cursor-pointer ${
                  selectedMonthFilter === m.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.label} ({m.count})
              </button>
            ))}
          </div>
        )}

        {/* Quick Filter Pill Buttons (Akun Maintenance Cepat) */}
        {uniqueAccounts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Filter Cepat Akun:
            </span>
            <button
              type="button"
              onClick={() => setSelectedAccountFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition cursor-pointer ${
                selectedAccountFilter === 'all'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({items.length})
            </button>
            {uniqueAccounts.map((acc) => {
              const countAcc = items.filter((i) => i.createdBy === acc).length;
              return (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setSelectedAccountFilter(acc)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                    selectedAccountFilter === acc
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <User className="w-3 h-3 text-slate-400" />
                  <span>{acc.replace(/@.+$/, '')}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    selectedAccountFilter === acc ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {countAcc}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Konten Utama Daftar Temuan Abnormal */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-700">Memuat data temuan abnormal seluruh akun...</p>
          <p className="text-xs text-slate-400 mt-0.5">Menyinkronkan status dari Cloud Firestore</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {items.length === 0
                ? 'Semua Peralatan Beroperasi Normal'
                : 'Tidak Ada Temuan yang Sesuai Filter'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              {items.length === 0
                ? 'Tidak ada laporan dengan status kondisi abnormal yang tercatat pada seluruh akun maintenance saat ini.'
                : 'Coba ubah kata kunci pencarian atau sesuaikan pilihan filter akun di atas.'}
            </p>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedAccountFilter('all');
                setSelectedPhotoFilter('all');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredItems.map((item) => {
            const abnormal = item.abnormalFinding;
            const targetUnit = abnormal.unitName || item.specificDetail || item.maintenanceName;
            const hasPhoto = Boolean(abnormal.photoBase64);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-2xl sm:rounded-3xl border border-rose-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Header Card */}
                <div className="p-4 sm:p-5 border-b border-rose-100 bg-gradient-to-r from-rose-50/50 via-white to-amber-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white border border-red-700 flex items-center gap-1 shadow-2xs">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> ABNORMAL
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {item.documentType.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-600" />
                          <span className="truncate max-w-[140px]">{item.createdBy}</span>
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug group-hover:text-rose-950 transition-colors">
                        {targetUnit}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                        Laporan: <strong className="text-slate-700 font-semibold">{item.maintenanceName}</strong>
                      </p>
                    </div>

                    {/* Badge Waktu Temuan */}
                    <div className="text-right shrink-0 text-slate-400">
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.maintenanceTime || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body Card */}
                <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Deskripsi Kerusakan / Temuan */}
                    <div
                      onClick={() => setViewingDetailItem(item)}
                      className="p-3 bg-rose-50/70 hover:bg-rose-50 border border-rose-200 rounded-xl space-y-1 cursor-pointer transition"
                      title="Klik untuk melihat detail lengkap di pop-up"
                    >
                      <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Deskripsi Kelainan / Kerusakan:
                        </span>
                        <span className="text-[10px] text-sky-700 font-bold flex items-center gap-0.5 hover:underline">
                          <Eye className="w-2.5 h-2.5" /> Lihat Detail
                        </span>
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                        {abnormal.description || 'Tidak ada deskripsi rinci.'}
                      </p>
                    </div>

                    {/* Rekomendasi Tindakan (Jika ada / prompt tambah) */}
                    {abnormal.actionRecommendation ? (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-amber-600" /> Rekomendasi / Tindakan Lanjutan:
                        </span>
                        <p className="text-xs text-amber-950 font-medium leading-relaxed">
                          {abnormal.actionRecommendation}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Rekomendasi tindakan belum diisi</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer shrink-0"
                        >
                          + Lengkapi
                        </button>
                      </div>
                    )}

                    {/* Foto Bukti Preview Thumbnail */}
                    {hasPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 group/photo">
                        <img
                          src={abnormal.photoBase64}
                          alt={targetUnit}
                          className="w-full h-40 object-cover cursor-pointer group-hover/photo:scale-102 transition-transform duration-300"
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
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer gap-1.5 text-white text-xs font-bold"
                        >
                          <Camera className="w-4 h-4 text-amber-300" />
                          <span>Klik untuk Memperbesar Foto</span>
                        </div>
                        <div className="p-2 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="font-semibold flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-rose-600" /> Bukti Foto Terlampir
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAutoCropText(item)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                              title="Potong otomatis bagian atas teks dan hanya simpan bagian foto"
                            >
                              <Scissors className="w-3 h-3" /> Ambil Foto Saja
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCropItem(item)}
                              className="text-slate-600 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                              title="Crop manual foto ini"
                            >
                              <Crop className="w-3 h-3" /> Crop
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                src: abnormal.photoBase64!,
                                title: targetUnit,
                                unit: targetUnit,
                                account: item.createdBy,
                                item
                              })}
                              className="text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer"
                            >
                              Perbesar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-slate-300" />
                        <span>Dokumen disimpan tanpa lampiran foto bukti (deskripsi tercatat)</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Pelapor */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Pelapor: <strong className="text-slate-700">{abnormal.reportedBy || item.createdBy}</strong>
                    </span>
                    {abnormal.reportedAt && (
                      <span>
                        Dilaporkan: {new Date(abnormal.reportedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Tombol Utama: Lihat Temuan (Pop-up Modal) */}
                    <button
                      type="button"
                      onClick={() => setViewingDetailItem(item)}
                      className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Buka pop-up detail lengkap temuan abnormal ini"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                      <span>Lihat Temuan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadReportPDF(item)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Unduh berkas PDF resmi laporan ini"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Download PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingModalDoc(itemToExcelDoc(item))}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Edit / lengkapi deskripsi temuan, rekomendasi lanjutan, atau foto bukti"
                    >
                      <PenTool className="w-3.5 h-3.5 text-amber-600" />
                      <span>Edit Temuan</span>
                    </button>

                    {onNavigateToDocument && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDocument(item.fileName || item.maintenanceName)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Buka laporan ini di halaman Arsip Dokumen"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>Arsip</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Tombol QC DME / Admin: Hapus Temuan */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetItem(item)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Hapus data temuan abnormal ini dari sistem"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus</span>
                      </button>
                    )}

                    {/* Tombol QC DME: Tandai Normal */}
                    <button
                      type="button"
                      onClick={() => setConfirmNormalItem(item)}
                      className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 border border-emerald-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Tandai unit telah diperbaiki dan kembalikan ke status Normal"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tandai Normal (QC Selesai)</span>
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
                      {viewingDetailItem.maintenanceTime || '-'}
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

      {/* Modal Konfirmasi Hapus Temuan (Khusus QC DME / Admin) */}
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
    </div>
  );
}
