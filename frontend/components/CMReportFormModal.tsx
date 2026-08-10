// ============================================================================
// FILE: CMReportFormModal.tsx
// Deskripsi: Modal Wizard Form Laporan Corrective Maintenance (CM Report 3-Halaman).
//            Memandu Standby Engineer mengisi rincian laporan perbaikan darurat:
//            - Step 1: Informasi Tiket, Waktu Order, Pengguna & Lokasi Gangguan.
//            - Step 2: Rincian Kronologi Akar Masalah (PIR / Root Cause Analysis).
//            - Step 3: Pengadaan Suku Cadang / Spareparts Terpakai.
//            - Step 4: Lampiran Foto Bervariasi (Sebelum / Proses / Sesudah Pemeliharaan).
//            Menyediakan ekspor instan ke format DOCX (.docx) & PDF standar UTT.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Camera,
  Wrench,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Scissors,
  Download,
  Eye,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { CMReportData, CMSparepartItem, CMPhotoItem } from '@/types/correctiveReportTypes';
import { exportCMReportToDocx } from '@/utils/docxReportExport';
import { sendFileNotification } from '@/utils/notificationService';
import { ImageEditor } from './ImageEditor';

import { PREPARED_BY_SIGNATURES, ARIF_BUDIMAN_SIGNATURE_BASE64 } from '@/utils/engineerSignatures';

interface CMReportFormModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  editId?: string;
}

export function CMReportFormModal({ onSuccess, onCancel, editId }: CMReportFormModalProps) {
  const { user, userRole } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Form State initialized with empty guide fields
  const [formData, setFormData] = useState<CMReportData>({
    reportType: 'CM_PDF',
    incidentName: '',
    location: '',
    incidentDate: '',
    incidentId: '',

    equipmentName: '',
    brand: '',
    serialNumber: '',
    installationDate: '',

    correctiveAction: '',
    repairTimeStart: '',
    repairTimeEnd: '',
    result: '',

    visualInspectionChecking: '',
    cleaningPreventiveMethod: '',
    summaryProblemAnalysis: '',

    spareparts: [
      { name: '-', brand: '-', qty: '-' },
      { name: '-', brand: '-', qty: '-' }
    ],

    photos: [],

    authorName: 'Rizki Novri Yanda – Data Center Operation',
    preparedByName: 'Muhammad Salman Abdurohman',
    preparedByTitle: '(Electrical Engineer)',
    preparedBySign: PREPARED_BY_SIGNATURES['Muhammad Salman Abdurohman'],
    reviewedByName: 'Arif Budiman',
    reviewedByTitle: '(Technical Manager)',
    reviewedBySign: ARIF_BUDIMAN_SIGNATURE_BASE64,
    acknowledgedBy1Name: 'Andrean Bima Pratama',
    acknowledgedBy1Title: '(Chief Engineer)',
    acknowledgedBy2Name: 'Supriyatno',
    acknowledgedBy2Title: '(Facility manager)',
    approvedByName: 'Budi Susanto',
    approvedByTitle: '(Assistant manager HDC Facility Management)'
  });

  // Load draft or existing report if editing
  useEffect(() => {
    if (editId) {
      const fetchReport = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'corrective_reports', editId));
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setFormData({
              ...formData,
              ...data,
              spareparts: data.spareparts || [
                { name: '-', brand: '-', qty: '-' },
                { name: '-', brand: '-', qty: '-' }
              ],
              photos: data.photos || (data.photoBase64 ? [{ photoBase64: data.photoBase64 }] : [])
            });
          }
        } catch (err) {
          console.error('Failed to fetch CM report:', err);
          toast.error('Gagal memuat data laporan CM');
        }
      };
      fetchReport();
    } else {
      const savedDraft = localStorage.getItem('cm_report_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.formData) {
            let pName = parsed.formData.preparedByName;
            if (pName === 'Salman') pName = 'Muhammad Salman Abdurohman';
            if (pName === 'Agil') pName = 'Agil Zakia Amanda';
            if (pName === 'Asep') pName = 'Asep Mohammad Fauzi';
            pName = pName || 'Muhammad Salman Abdurohman';

            const rName = parsed.formData.reviewedByName || 'Arif Budiman';
            const rSign = parsed.formData.reviewedBySign || (rName.toLowerCase().includes('arif') || rName.toLowerCase().includes('budiman') ? ARIF_BUDIMAN_SIGNATURE_BASE64 : '');
            const pSign = parsed.formData.preparedBySign || (PREPARED_BY_SIGNATURES as Record<string, string>)[pName] || '';

            setFormData({
              ...parsed.formData,
              preparedByName: pName,
              preparedBySign: pSign,
              reviewedByName: rName,
              reviewedBySign: rSign,
            });
          }
          if (parsed.currentStep) {
            setCurrentStep(parsed.currentStep);
          }
        } catch (e) {
          console.error('Failed to parse CM draft', e);
        }
      }
    }
  }, [editId]);

  // Auto-save draft to localStorage whenever form changes (only when not editing)
  useEffect(() => {
    if (!editId) {
      try {
        localStorage.setItem('cm_report_draft', JSON.stringify({ formData, currentStep }));
      } catch (err) {
        console.warn('CM draft auto-save quota exceeded, skipping localStorage:', err);
      }
    }
  }, [formData, currentStep, editId]);

  // Handle Multi Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - formData.photos.length;
    if (remainingSlots <= 0) {
      toast.error('Maksimal 10 foto dokumentasi');
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const processFile = (file: File): Promise<CMPhotoItem> => {
      return new Promise((resolve) => {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`Ukuran file ${file.name} melebihi 20MB`);
          resolve({ photoBase64: '', description: '' });
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const MAX_WIDTH = 900;
            const MAX_HEIGHT = 900;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = (width * MAX_HEIGHT) / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            resolve({
              photoBase64: compressedBase64,
              description: ''
            });
          };
          img.onerror = () => resolve({ photoBase64: '', description: '' });
        };
        reader.onerror = () => resolve({ photoBase64: '', description: '' });
      });
    };

    const newPhotoItems = await Promise.all(filesToProcess.map(processFile));
    const validPhotoItems = newPhotoItems.filter((p: CMPhotoItem) => p.photoBase64 !== '');

    if (validPhotoItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...validPhotoItems]
      }));
      toast.success(`${validPhotoItems.length} foto berhasil ditambahkan`);
    }
  };

  const updatePhotoDescription = (index: number, description: string) => {
    setFormData(prev => {
      const updated = [...prev.photos];
      updated[index] = { ...updated[index], description };
      return { ...prev, photos: updated };
    });
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleApplyEditPhoto = (editedBase64: string) => {
    if (editingPhotoIndex !== null) {
      const updatedPhotos = [...formData.photos];
      updatedPhotos[editingPhotoIndex] = { ...updatedPhotos[editingPhotoIndex], photoBase64: editedBase64 };
      setFormData(prev => ({ ...prev, photos: updatedPhotos }));
      setEditingPhotoIndex(null);
      toast.success('Foto berhasil diperbarui!');
    }
  };

  // Sparepart Dynamic Handlers
  const addSparepart = () => {
    setFormData(prev => ({
      ...prev,
      spareparts: [...prev.spareparts, { name: '', brand: '', qty: '' }]
    }));
  };

  const updateSparepart = (index: number, field: keyof CMSparepartItem, val: string) => {
    const updated = [...formData.spareparts];
    updated[index] = { ...updated[index], [field]: val };
    setFormData(prev => ({ ...prev, spareparts: updated }));
  };

  const removeSparepart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      spareparts: prev.spareparts.filter((_, i) => i !== index)
    }));
  };

  // Validate step navigation
  const validateStep = (targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;

    // Step 1 Validation
    if (targetStep > 1) {
      if (!formData.incidentName?.trim()) {
        toast.error('Mohon isi Incident Name di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.location?.trim()) {
        toast.error('Mohon isi Location di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.incidentDate?.trim()) {
        toast.error('Mohon isi Incident Date di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.equipmentName?.trim()) {
        toast.error('Mohon isi Equipment Name di Step 1');
        setCurrentStep(1);
        return false;
      }
    }

    // Step 2 Validation
    if (targetStep > 2) {
      if (!formData.correctiveAction?.trim()) {
        toast.error('Mohon isi Corrective Action di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.repairTimeStart?.trim() || !formData.repairTimeEnd?.trim()) {
        toast.error('Mohon isi Jam Start & Jam End Repair Time di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.result?.trim()) {
        toast.error('Mohon isi Result (Hasil Akhir) di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.summaryProblemAnalysis?.trim()) {
        toast.error('Mohon isi Problem Analysis Summary di Step 2');
        setCurrentStep(2);
        return false;
      }
    }

    // Step 3 Validation (Photos optional so step 4 TTD can be accessed)
    return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (validateStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  // Handle Export DOCX (Word)
  const handleExportDocx = async () => {
    try {
      let dateFormatted = formData.incidentDate;
      if (formData.incidentDate) {
        const d = new Date(formData.incidentDate);
        if (!isNaN(d.getTime())) {
          dateFormatted = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        }
      }
      if (!dateFormatted) {
        dateFormatted = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      }

      const prepName = formData.preparedByName || 'Muhammad Salman Abdurohman';
      const prepSign = formData.preparedBySign || (PREPARED_BY_SIGNATURES as Record<string, string>)[prepName] || '';
      const revName = formData.reviewedByName || 'Arif Budiman';
      const revSign = formData.reviewedBySign || (revName.toLowerCase().includes('arif') || revName.toLowerCase().includes('budiman') ? ARIF_BUDIMAN_SIGNATURE_BASE64 : '');

      const formattedData: CMReportData = {
        ...formData,
        incidentName: formData.incidentName || formData.equipmentName || 'Corrective Maintenance Report',
        equipmentName: formData.equipmentName || formData.incidentName || 'Equipment',
        location: formData.location || 'Neutra DC Cikarang',
        incidentDate: dateFormatted,
        incidentId: formData.incidentId || 'N/A',
        brand: formData.brand || 'Daikin',
        serialNumber: formData.serialNumber || 'N/A',
        installationDate: formData.installationDate || 'N/A',
        correctiveAction: formData.correctiveAction || '-',
        repairTimeStart: formData.repairTimeStart || '-',
        repairTimeEnd: formData.repairTimeEnd || '-',
        result: formData.result || 'Status perbaikan telah selesai dilaksanakan dengan baik.',
        visualInspectionChecking: formData.visualInspectionChecking || 'Pengecekan kondisi fisik dan fungsi operasional peralatan.',
        cleaningPreventiveMethod: formData.cleaningPreventiveMethod || 'Pembersihan area kerja dan komponen pendukung.',
        summaryProblemAnalysis: formData.summaryProblemAnalysis || 'Analisis dan pemulihan sistem operasional peralatan.',
        preparedByName: prepName,
        preparedBySign: prepSign,
        preparedByTitle: formData.preparedByTitle || '(Electrical Engineer)',
        reviewedByName: revName,
        reviewedByTitle: formData.reviewedByTitle || '(Technical Manager)',
        reviewedBySign: revSign,
        acknowledgedBy1Name: formData.acknowledgedBy1Name || 'Andrean Bima Pratama',
        acknowledgedBy1Title: formData.acknowledgedBy1Title || '(Chief Engineer)',
        acknowledgedBy2Name: formData.acknowledgedBy2Name || 'Supriyatno',
        acknowledgedBy2Title: formData.acknowledgedBy2Title || '(Facility manager)',
        approvedByName: formData.approvedByName || 'Budi Susanto',
        approvedByTitle: formData.approvedByTitle || '(Assistant manager HDC Facility Management)',
      };

      await exportCMReportToDocx(formattedData);

      // Auto-save to Firestore so it is immediately visible in Arsip Standby
      if (user) {
        const reportPayload = {
          ...formattedData,
          issue: formattedData.incidentName || formattedData.summaryProblemAnalysis || 'Laporan Issue CM',
          actionTaken: formattedData.correctiveAction || '-',
          category: 'CM',
          reportedBy: user.uid,
          reportedByEmail: user.email,
          reportedAt: serverTimestamp(),
        };
        if (editId) {
          await updateDoc(doc(db, 'corrective_reports', editId), reportPayload);
        } else {
          await addDoc(collection(db, 'corrective_reports'), reportPayload);
        }
      }

      localStorage.removeItem('cm_report_draft');
      toast.success('Laporan CM Word (DOCX) berhasil diekspor & disimpan ke Arsip Standby!');
    } catch (err: any) {
      console.error('Error exporting DOCX:', err);
      toast.error('Gagal mengekspor Laporan CM Word');
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleStepClick(currentStep + 1);
      return;
    }
    if (currentStep !== 4) return;
    if (!validateStep(4)) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const prepName = formData.preparedByName || 'Muhammad Salman Abdurohman';
      const prepSign = formData.preparedBySign || (PREPARED_BY_SIGNATURES as Record<string, string>)[prepName] || '';
      const revName = formData.reviewedByName || 'Arif Budiman';
      const revSign = formData.reviewedBySign || (revName.toLowerCase().includes('arif') || revName.toLowerCase().includes('budiman') ? ARIF_BUDIMAN_SIGNATURE_BASE64 : '');

      const reportPayload = {
        ...formData,
        preparedByName: prepName,
        preparedBySign: prepSign,
        reviewedByName: revName,
        reviewedBySign: revSign,
        incidentId: formData.incidentId || 'N/A',
        issue: formData.incidentName || formData.summaryProblemAnalysis || formData.visualInspectionChecking || 'Laporan Issue CM',
        actionTaken: formData.correctiveAction || '-',
        category: 'CM',
        reportedBy: user.uid,
        reportedByEmail: user.email,
        reportedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, 'corrective_reports', editId), reportPayload);
        toast.success('Laporan CM berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'corrective_reports'), reportPayload);
        localStorage.removeItem('cm_report_draft');
        toast.success('Laporan CM berhasil disimpan!');

        await sendFileNotification({
          title: `Laporan CM Baru: ${formData.incidentName || formData.equipmentName || 'AC VRV'}`,
          fileName: formData.incidentName || formData.equipmentName || 'Laporan CM',
          category: 'Report CM',
          uploadedBy: user.email || 'Standby Engineer',
          targetTab: 'corrective_archive',
          searchQuery: formData.incidentName || formData.equipmentName || ''
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error saving CM report:', err);
      toast.error('Gagal menyimpan laporan CM');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
      {/* Header Modal */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 p-3.5 sm:p-5 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl backdrop-blur-xs shrink-0">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-xl font-bold leading-tight truncate sm:whitespace-normal">Form Laporan Corrective Maintenance (CM)</h2>
            <p className="text-[10px] sm:text-xs text-rose-100 mt-0.5 truncate sm:whitespace-normal">Sesuai format resmi Word (DOCX) & PDF Standby Engineer</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition cursor-pointer shrink-0"
          title="Tutup Form"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 sm:p-4">
        <div className="grid grid-cols-4 sm:flex sm:items-center sm:justify-between gap-1 sm:gap-2">
          {[
            { step: 1, label: '1. Incident & Peralatan', shortLabel: '1. Incident' },
            { step: 2, label: '2. Perbaikan & Analisis', shortLabel: '2. Perbaikan' },
            { step: 3, label: '3. Sparepart & Foto', shortLabel: '3. Sparepart' },
            { step: 4, label: '4. TTD & Export DOCX', shortLabel: '4. Export' }
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => handleStepClick(item.step)}
              className={`px-1 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition cursor-pointer ${
                currentStep === item.step
                  ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] shrink-0 ${
                currentStep === item.step ? 'bg-white text-red-600 font-extrabold' : 'bg-slate-200 text-slate-700'
              }`}>
                {item.step}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
              <span className="inline sm:hidden text-[10px] leading-none truncate max-w-full text-center">{item.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: INCIDENT & EQUIPMENT */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-2">
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <AlertCircleIcon className="w-4 h-4 text-red-600" />
                  Informasi Kejadian (Incident Metadata)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NAMA ISSUE / INCIDENT NAME *</label>
                  <input
                    type="text"
                    required
                    value={formData.incidentName}
                    onChange={e => setFormData({ ...formData, incidentName: e.target.value })}
                    placeholder="e.g. Pompa Groundtank Bocor / Error Code U9-01 CRAC 2"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">LOCATION *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Organic Room"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className={userRole === 'standby_engineer' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">INCIDENT DATE</label>
                  <input
                    type="text"
                    value={formData.incidentDate}
                    onChange={e => setFormData({ ...formData, incidentDate: e.target.value })}
                    placeholder="e.g. 24-Juli-2026"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                {userRole !== 'standby_engineer' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">INCIDENT ID</label>
                    <input
                      type="text"
                      value={formData.incidentId}
                      onChange={e => setFormData({ ...formData, incidentId: e.target.value })}
                      placeholder="e.g. N/A"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-600" />
                  Informasi Unit / Peralatan (Equipment Metadata)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">EQUIPMENT NAME</label>
                  <input
                    type="text"
                    value={formData.equipmentName}
                    onChange={e => setFormData({ ...formData, equipmentName: e.target.value })}
                    placeholder="e.g. DAIKIN VRV"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BRAND</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. DAIKIN"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SERIAL NUMBER</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="e.g. N/A"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">INSTALLATION DATE</label>
                  <input
                    type="text"
                    value={formData.installationDate}
                    onChange={e => setFormData({ ...formData, installationDate: e.target.value })}
                    placeholder="e.g. N/A"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: ACTION & INSPECTION */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">CORRECTIVE ACTION * (Bisa Multiline)</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.correctiveAction}
                    onChange={e => setFormData({ ...formData, correctiveAction: e.target.value })}
                    placeholder="- Melakukan pengecekan unit...\n- Melakukan reset system..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-y"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">REPAIR TIME</label>
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Jam Start:</span>
                    <input
                      type="text"
                      value={formData.repairTimeStart}
                      onChange={e => setFormData({ ...formData, repairTimeStart: e.target.value })}
                      placeholder="e.g. 12:49"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Jam End:</span>
                    <input
                      type="text"
                      value={formData.repairTimeEnd}
                      onChange={e => setFormData({ ...formData, repairTimeEnd: e.target.value })}
                      placeholder="e.g. 14:56"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">RESULT (Hasil Akhir)</label>
                <textarea
                  rows={2}
                  value={formData.result}
                  onChange={e => setFormData({ ...formData, result: e.target.value })}
                  placeholder="e.g. Status error berhasil terhapus, komunikasi antar unit kembali normal..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">VISUAL INSPECTION & CHECKING</label>
                <textarea
                  rows={3}
                  value={formData.visualInspectionChecking}
                  onChange={e => setFormData({ ...formData, visualInspectionChecking: e.target.value })}
                  placeholder="e.g. Ditemukan kode error U9-01 pada remote ac VRV..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CLEANING & PREVENTIVE METHOD</label>
                <input
                  type="text"
                  value={formData.cleaningPreventiveMethod}
                  onChange={e => setFormData({ ...formData, cleaningPreventiveMethod: e.target.value })}
                  placeholder="e.g. N/A"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)</label>
                <textarea
                  rows={4}
                  value={formData.summaryProblemAnalysis}
                  onChange={e => setFormData({ ...formData, summaryProblemAnalysis: e.target.value })}
                  placeholder="e.g. Ac VRV pada ruang organik menimbulkan kode error..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-y"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 3: SPAREPARTS & PHOTOS */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              {/* SPAREPARTS TABLE DYNAMIC */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">LIST OF REQUIRED SPAREPART (Halaman 2)</h3>
                  <button
                    type="button"
                    onClick={addSparepart}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.spareparts.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl">
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateSparepart(idx, 'name', e.target.value)}
                        placeholder="Nama Sparepart (e.g. - atau Thermostat)"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 outline-none"
                      />
                      <input
                        type="text"
                        value={item.brand}
                        onChange={e => updateSparepart(idx, 'brand', e.target.value)}
                        placeholder="Brand (e.g. DAIKIN)"
                        className="w-28 sm:w-36 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 outline-none"
                      />
                      <input
                        type="text"
                        value={item.qty}
                        onChange={e => updateSparepart(idx, 'qty', e.target.value)}
                        placeholder="Qty (e.g. 1 Pcs)"
                        className="w-20 sm:w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeSparepart(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHOTOS DOKUMENTASI (Max 10, layout grid di PDF) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">FOTO DOKUMENTASI VISUAL INSPECTION (Maks 10 Foto)</label>
                  <span className="text-xs text-slate-500">{formData.photos.length} / 10 Foto Uploaded</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="bg-white border border-slate-300 rounded-xl p-2.5 shadow-xs space-y-2">
                      <div className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-100 aspect-4/3">
                        <img src={photo.photoBase64} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(photo.photoBase64)}
                            className="p-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                            title="Lihat Foto Fullscreen"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPhotoIndex(idx)}
                            className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                            title="Crop / Edit Foto"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = photo.photoBase64;
                              link.download = `foto_dokumentasi_${idx + 1}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="p-1.5 bg-emerald-600/90 hover:bg-emerald-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                            title="Unduh Foto"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                            title="Hapus Foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-md">
                          Foto {idx + 1}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                          Deskripsi Foto {idx + 1}
                        </label>
                        <input
                          type="text"
                          value={photo.description || ''}
                          onChange={(e) => updatePhotoDescription(idx, e.target.value)}
                          placeholder="Contoh: Kondisi fisik unit sebelum perbaikan..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-red-500 focus:bg-white outline-none transition"
                        />
                      </div>
                    </div>
                  ))}

                  {formData.photos.length < 10 && (
                    <label className="border-2 border-dashed border-slate-300 hover:border-red-500 bg-slate-50 hover:bg-red-50/20 rounded-xl aspect-4/3 flex flex-col items-center justify-center cursor-pointer transition p-4 text-center">
                      <Camera className="w-8 h-8 text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-600">Pilih Foto (Bisa Banyak)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Tekan &amp; pilih lebih dari 1 foto sekaligus (Maks 10)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SIGNATURES & EXPORT PDF */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">AUTHOR BY (Pembuat Laporan)</label>
                <input
                  type="text"
                  value={formData.authorName}
                  onChange={e => setFormData({ ...formData, authorName: e.target.value })}
                  placeholder="e.g. Rizki Novri Yanda – Data Center Operation"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Tanda Tangan Grid Customizer */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kustomisasi Nama & Jabatan Tanda Tangan (Halaman 3)</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PREPARED BY */}
                  <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-red-600 block">1. PREPARED BY</span>
                    <select
                      value={formData.preparedByName}
                      onChange={e => {
                        const selectedName = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          preparedByName: selectedName,
                          preparedBySign: (PREPARED_BY_SIGNATURES as Record<string, string>)[selectedName] || prev.preparedBySign || ''
                        }));
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                    >
                      <option value="Muhammad Salman Abdurohman">Muhammad Salman Abdurohman</option>
                      <option value="Agil Zakia Amanda">Agil Zakia Amanda</option>
                      <option value="Asep Mohammad Fauzi">Asep Mohammad Fauzi</option>
                    </select>
                    <input
                      type="text"
                      value={formData.preparedByTitle}
                      onChange={e => setFormData({ ...formData, preparedByTitle: e.target.value })}
                      placeholder="Jabatan (e.g. (Electrical Engineer))"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  {/* REVIEWED BY */}
                  <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-red-600 block">2. REVIEWED BY</span>
                    <input
                      type="text"
                      value={formData.reviewedByName}
                      onChange={e => setFormData({ ...formData, reviewedByName: e.target.value })}
                      placeholder="Nama (e.g. Arif Budiman)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={formData.reviewedByTitle}
                      onChange={e => setFormData({ ...formData, reviewedByTitle: e.target.value })}
                      placeholder="Jabatan (e.g. (Technical Manager))"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  {/* ACKNOWLEDGED 1 */}
                  <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-red-600 block">3. ACKNOWLEDGED BY (Kiri)</span>
                    <input
                      type="text"
                      value={formData.acknowledgedBy1Name}
                      onChange={e => setFormData({ ...formData, acknowledgedBy1Name: e.target.value })}
                      placeholder="Nama (e.g. Andrean Bima Pratama)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={formData.acknowledgedBy1Title}
                      onChange={e => setFormData({ ...formData, acknowledgedBy1Title: e.target.value })}
                      placeholder="Jabatan (e.g. (Chief Engineer))"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  {/* ACKNOWLEDGED 2 */}
                  <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-red-600 block">4. ACKNOWLEDGED BY (Kanan)</span>
                    <input
                      type="text"
                      value={formData.acknowledgedBy2Name}
                      onChange={e => setFormData({ ...formData, acknowledgedBy2Name: e.target.value })}
                      placeholder="Nama (e.g. Supriyatno)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={formData.acknowledgedBy2Title}
                      onChange={e => setFormData({ ...formData, acknowledgedBy2Title: e.target.value })}
                      placeholder="Jabatan (e.g. (Facility manager))"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* APPROVED BY */}
                <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-red-600 block">5. APPROVED BY (Tengah)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.approvedByName}
                      onChange={e => setFormData({ ...formData, approvedByName: e.target.value })}
                      placeholder="Nama (e.g. Budi Susanto)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={formData.approvedByTitle}
                      onChange={e => setFormData({ ...formData, approvedByTitle: e.target.value })}
                      placeholder="Jabatan (e.g. (Assistant manager HDC Facility Management))"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-6 mt-6">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 4 && (
              <button
                key="btn-export-docx"
                type="button"
                onClick={handleExportDocx}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Export DOCX
              </button>
            )}

            {currentStep < 4 ? (
              <button
                key={`btn-next-step-${currentStep}`}
                type="button"
                onClick={() => handleStepClick(currentStep + 1)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-500/20 transition cursor-pointer"
              >
                Lanjut
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                key="btn-submit-cm-report"
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Simpan Laporan CM
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Image Editor Modal for cropping */}
      {editingPhotoIndex !== null && (
        <ImageEditor
          image={formData.photos[editingPhotoIndex]?.photoBase64 || ''}
          onSave={handleApplyEditPhoto}
          onCancel={() => setEditingPhotoIndex(null)}
        />
      )}

      {/* Fullscreen Photo Lightbox Preview */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl p-2 border border-slate-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition z-10 cursor-pointer"
              title="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewPhotoUrl} alt="Preview Foto Fullscreen" className="max-w-full max-h-[82vh] object-contain rounded-xl mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCircleIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
      <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
    </svg>
  );
}
