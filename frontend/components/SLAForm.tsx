import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  MapPin,
  PenTool,
  CheckCircle2,
  Trash2,
  Loader2,
  Calendar,
  Clock,
  User,
  Shield,
  ArrowRight,
  ArrowLeft,
  Activity,
  Check,
  ChevronRight,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { exportSLAReportToDocx } from '@/utils/docxReportExport';
import { sendFileNotification } from '@/utils/notificationService';

interface SLAFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editId?: string;
}

export function SLAForm({ onSuccess, onCancel, editId }: SLAFormProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    ticketName: '',
    location: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    picDME: '',
    picTDE: '',
    remark: '',

    // Response Time (Step 1)
    timeOrder: '',
    actualTimeResponse: '',
    targetResponseMin: 10,
    photoResponse: '',

    // Engineer Onsite Support (Step 2)
    photoEngineerOnsite: '',

    // Onsite Principle Support (Step 3)
    actualTimeOnsite: '',
    targetOnsiteMin: 120,
    photoOnsite: '',

    // Restore Service Time (Step 4)
    startOrder: '',
    finishOrder: '',
    targetRestoreMin: 180,
    photoRestore: '',

    // Resolution Time (Step 5)
    targetResolutionMin: 180,
    photoResolution: '',
  });

  // Load draft or existing report if editing
  useEffect(() => {
    if (editId) {
      const fetchReport = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'corrective_reports', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              ticketName: data.ticketName || '',
              location: data.location || '',
              priority: data.priority || 'Medium',
              picDME: data.picDME || '',
              picTDE: data.picTDE || '',
              remark: data.remark || '',
              timeOrder: data.timeOrder || '',
              actualTimeResponse: data.actualTimeResponse || '',
              targetResponseMin: data.targetResponseMin || 10,
              photoResponse: data.photoResponse || '',
              photoEngineerOnsite: data.photoEngineerOnsite || '',
              actualTimeOnsite: data.actualTimeOnsite || '',
              targetOnsiteMin: data.targetOnsiteMin || 120,
              photoOnsite: data.photoOnsite || '',
              startOrder: data.startOrder || '',
              finishOrder: data.finishOrder || '',
              targetRestoreMin: data.targetRestoreMin || 180,
              photoRestore: data.photoRestore || '',
              targetResolutionMin: data.targetResolutionMin || 180,
              photoResolution: data.photoResolution || '',
            });
          }
        } catch (error) {
          console.error('Error fetching report for edit:', error);
          toast.error('Gagal mengambil data laporan untuk diedit');
        }
      };
      fetchReport();
    } else {
      const savedDraft = localStorage.getItem('sla_form_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.formData) {
            setFormData(parsed.formData);
          }
          if (parsed.currentStep) {
            setCurrentStep(parsed.currentStep);
          }
        } catch (e) {
          console.error('Failed to parse SLA draft', e);
        }
      }
    }
  }, [editId]);

  // Auto-save draft to localStorage whenever form changes (only when not editing)
  useEffect(() => {
    if (!editId) {
      try {
        localStorage.setItem('sla_form_draft', JSON.stringify({ formData, currentStep }));
      } catch (err) {
        console.warn('SLA draft auto-save quota exceeded, skipping localStorage:', err);
      }
    }
  }, [formData, currentStep, editId]);

  // Derived Calculations
  const [calcs, setCalcs] = useState({
    responseTimeMin: 0,
    responseComply: true,
    onsiteTimeMin: 0,
    onsiteComply: true,
    restoreTimeMin: 0,
    restoreComply: true,
    resolutionTimeMin: 0,
    resolutionComply: true,
  });

  // Calculate SLA values automatically on form changes
  useEffect(() => {
    const calculateDiffMinutes = (startStr: string, endStr: string): number => {
      if (!startStr || !endStr) return 0;
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diffMs = end.getTime() - start.getTime();
      if (isNaN(diffMs) || diffMs < 0) return 0;
      return Math.round(diffMs / (1000 * 60));
    };

    const responseTime = calculateDiffMinutes(formData.timeOrder, formData.actualTimeResponse);
    const onsiteTime = calculateDiffMinutes(formData.timeOrder, formData.actualTimeOnsite);
    const restoreTime = calculateDiffMinutes(formData.startOrder || formData.timeOrder, formData.finishOrder);
    const resolutionTime = calculateDiffMinutes(formData.startOrder || formData.timeOrder, formData.finishOrder);

    setCalcs({
      responseTimeMin: responseTime,
      responseComply: formData.timeOrder && formData.actualTimeResponse ? responseTime <= formData.targetResponseMin : true,
      onsiteTimeMin: onsiteTime,
      onsiteComply: formData.timeOrder && formData.actualTimeOnsite ? onsiteTime <= formData.targetOnsiteMin : true,
      restoreTimeMin: restoreTime,
      restoreComply: (formData.startOrder || formData.timeOrder) && formData.finishOrder ? restoreTime <= formData.targetRestoreMin : true,
      resolutionTimeMin: resolutionTime,
      resolutionComply: (formData.startOrder || formData.timeOrder) && formData.finishOrder ? resolutionTime <= formData.targetResolutionMin : true,
    });
  }, [
    formData.timeOrder,
    formData.actualTimeResponse,
    formData.targetResponseMin,
    formData.actualTimeOnsite,
    formData.targetOnsiteMin,
    formData.startOrder,
    formData.finishOrder,
    formData.targetRestoreMin,
    formData.targetResolutionMin
  ]);

  // Sync Start Order with Time Order by default
  useEffect(() => {
    if (formData.timeOrder && !formData.startOrder) {
      setFormData(prev => ({ ...prev, startOrder: formData.timeOrder }));
    }
  }, [formData.timeOrder]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photoResponse' | 'photoEngineerOnsite' | 'photoOnsite' | 'photoRestore' | 'photoResolution') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Maksimal ukuran file foto adalah 15MB');
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

        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, [field]: compressedBase64 }));
        toast.success('Bukti foto berhasil diunggah!');
      };
    };
  };

  const validateStep = (targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;

    // Step 1 Validation
    if (targetStep > 1) {
      if (!formData.location?.trim()) {
        toast.error('Mohon lengkapi Lokasi Gangguan di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.timeOrder || !formData.actualTimeResponse) {
        toast.error('Mohon isi Waktu Order dan Waktu Respon Aktual di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.photoResponse) {
        toast.error('Mohon unggah Bukti Foto Response Time di Step 1');
        setCurrentStep(1);
        return false;
      }
    }

    // Step 2 Validation
    if (targetStep > 2) {
      if (!formData.photoEngineerOnsite) {
        toast.error('Mohon unggah Bukti Foto Engineer Onsite Support di Step 2');
        setCurrentStep(2);
        return false;
      }
    }

    // Step 3 Validation
    if (targetStep > 3) {
      if (!formData.actualTimeOnsite) {
        toast.error('Mohon isi Waktu Aktual Onsite di Step 3');
        setCurrentStep(3);
        return false;
      }
      if (!formData.photoOnsite) {
        toast.error('Mohon unggah Bukti Foto Onsite Principle Engineer di Step 3');
        setCurrentStep(3);
        return false;
      }
    }

    // Step 4 Validation
    if (targetStep > 4) {
      if (!formData.startOrder || !formData.finishOrder) {
        toast.error('Mohon isi Waktu Mulai dan Selesai Order di Step 4');
        setCurrentStep(4);
        return false;
      }
      if (!formData.photoRestore) {
        toast.error('Mohon unggah Bukti Foto Restore Service Time di Step 4');
        setCurrentStep(4);
        return false;
      }
    }

    // Step 5 Validation
    if (targetStep > 5) {
      if (!formData.photoResolution) {
        toast.error('Mohon unggah Bukti Foto Resolution Time di Step 5');
        setCurrentStep(5);
        return false;
      }
    }

    return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (validateStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  const handleNext = () => {
    handleStepClick(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(5)) return;
    if (!user) return;

    const isLocalhost = import.meta.env.DEV || (
      typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.endsWith('.local')
      )
    );

    if (!isLocalhost && !formData.photoResolution) {
      toast.error('Mohon unggah Bukti Foto Resolution Time pada Step 5');
      return;
    }

    setSubmitting(true);
    try {
      const finalReport = {
        reportType: 'SLA',
        ticketName: formData.ticketName.trim() || 'Work Order',
        location: formData.location,
        priority: formData.priority,
        picDME: formData.picDME.trim() || 'On Duty DME',
        picTDE: formData.picTDE.trim() || 'FMA - CBRE',
        remark: formData.remark.trim() || 'Team melaksanakan perbaikan corrective.',

        // Core calculations mapping for normal display compatibility
        issue: `[SLA / SLG] ${formData.ticketName.trim() || 'Work Order'} (${formData.priority})`,
        actionTaken: formData.remark.trim() || 'Pemeliharaan corrective diselesaikan sesuai target SLA.',
        status: 'Resolved',
        spareParts: '',
        quarter: `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
        year: new Date().getFullYear().toString(),

        // SLA 1: Response Time
        timeOrder: formData.timeOrder,
        actualTimeResponse: formData.actualTimeResponse,
        actualResponseTimeMin: calcs.responseTimeMin,
        targetResponseMin: formData.targetResponseMin,
        responseComply: calcs.responseComply,
        photoResponse: formData.photoResponse,

        // SLA 2: Engineer Onsite photo
        photoEngineerOnsite: formData.photoEngineerOnsite,

        // SLA 3: Onsite OPE
        actualTimeOnsite: formData.actualTimeOnsite,
        actualOnsiteTimeMin: calcs.onsiteTimeMin,
        targetOnsiteMin: formData.targetOnsiteMin,
        onsiteComply: calcs.onsiteComply,
        photoOnsite: formData.photoOnsite,

        // SLA 4: Restore RST
        startOrder: formData.startOrder,
        finishOrder: formData.finishOrder,
        actualRestoreTimeMin: calcs.restoreTimeMin,
        targetRestoreMin: formData.targetRestoreMin,
        restoreComply: calcs.restoreComply,
        photoRestore: formData.photoRestore,

        // SLA 5: Resolution RT
        actualResolutionTimeMin: calcs.resolutionTimeMin,
        targetResolutionMin: formData.targetResolutionMin,
        resolutionComply: calcs.resolutionComply,
        photoResolution: formData.photoResolution,

        // Metadata
        reportedBy: user.uid,
        reportedByEmail: user.email,
        reportedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, 'corrective_reports', editId), finalReport);
        toast.success('Laporan SLA/SLG Corrective Maintenance berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'corrective_reports'), finalReport);
        localStorage.removeItem('sla_form_draft');
        toast.success('Laporan SLA/SLG Corrective Maintenance berhasil disimpan!');

        await sendFileNotification({
          title: `Laporan SLA Baru: ${formData.ticketName || 'Work Order'}`,
          fileName: formData.ticketName || 'Form SLA/SLG',
          category: 'Form SLA/SLG',
          uploadedBy: user?.email || 'Standby Engineer',
          targetTab: 'corrective_archive',
          searchQuery: formData.ticketName || ''
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving SLA report:', error);
      toast.error('Gagal menyimpan laporan ke database.');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { title: 'Response Time', desc: 'SLA Respon (10 M)' },
    { title: 'Engineer Onsite', desc: 'Bukti Onsite Eng' },
    { title: 'Onsite Principle', desc: 'SLA Onsite (2 H)' },
    { title: 'Restore Time', desc: 'SLA Restore (3 H)' },
    { title: 'Resolution', desc: 'SLA Resolusi' }
  ];

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xl overflow-hidden relative text-slate-800">
      {/* Step Indicators */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => handleStepClick(idx + 1)}>
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: currentStep >= idx + 1 ? '#dc2626' : '#f1f5f9',
                    borderColor: currentStep >= idx + 1 ? '#ef4444' : '#cbd5e1',
                    scale: currentStep === idx + 1 ? 1.1 : 1
                  }}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 text-xs sm:text-sm font-bold ${
                    currentStep >= idx + 1 ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {currentStep > idx + 1 ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : idx + 1}
                </motion.div>
                <div className="hidden sm:block text-[11px] text-slate-500 font-semibold mt-2 text-center absolute top-10 w-24">
                  {step.title}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-[2px] bg-slate-200 relative mx-1 sm:mx-2">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: currentStep > idx + 1 ? '100%' : '0%' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-rose-500"
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile-only Step Description */}
        <div className="mt-4 sm:hidden flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <div className="text-left">
            <span className="text-[10px] text-red-600 uppercase font-extrabold tracking-wider block">Langkah {currentStep} dari 5</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">{steps[currentStep - 1].title}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{steps[currentStep - 1].desc}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs shrink-0">
            <span>Tap Nomor Step</span>
            <ChevronRight className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Wizard Form Container */}
      <form onSubmit={handleSubmit} className="mt-6 sm:mt-8">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-600" />
                  Step 1: Pencapaian Response Time SLA
                </h3>
                <p className="text-slate-500 text-xs">Masukkan informasi order tiket, lokasi, prioritas, dan data Response Time (Target default 10 Menit).</p>
              </div>

              {/* Ticket Metadata (merged into Step 1) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Nama Order / Tiket (Opsional)</label>
                  <div className="relative group">
                    <PenTool className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition" />
                    <input
                      type="text"
                      value={formData.ticketName}
                      onChange={(e) => setFormData({ ...formData, ticketName: e.target.value })}
                      placeholder="Contoh: WO-2026-001 / Reset AC VRV"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Lokasi Gangguan *</label>
                  <div className="relative group">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition" />
                    <input
                      required
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Contoh: Bravo / Koridor Campus / Rooftop"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Prioritas Gangguan</label>
                  <div className="relative group">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition" />
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      title="Prioritas Gangguan"
                      aria-label="Prioritas Gangguan"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    >
                      <option value="Low">Low (Rendah)</option>
                      <option value="Medium">Medium (Sedang)</option>
                      <option value="High">High (Tinggi)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Response Time Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-700/30 pt-5">
                <div>
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Waktu Order Masuk (Time Order) *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.timeOrder}
                      onChange={(e) => setFormData({ ...formData, timeOrder: e.target.value })}
                      title="Waktu Order Masuk"
                      placeholder="Pilih waktu order masuk"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Waktu Respon Aktual *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.actualTimeResponse}
                      onChange={(e) => setFormData({ ...formData, actualTimeResponse: e.target.value })}
                      title="Waktu Respon Aktual"
                      placeholder="Pilih waktu respon aktual"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target (Menit)</label>
                  <input
                    type="number"
                    value={formData.targetResponseMin}
                    onChange={(e) => setFormData({ ...formData, targetResponseMin: parseInt(e.target.value) || 10 })}
                    title="Target Response Time"
                    placeholder="Contoh: 10"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                  />
                </div>
              </div>

              {/* Real-time Calculation Display */}
              {formData.timeOrder && formData.actualTimeResponse && (
                <div className={`p-4 rounded-xl border flex items-center justify-between transition ${
                  calcs.responseComply
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <div>
                      <span className="text-xs uppercase font-bold block">Durasi Respon Aktual</span>
                      <span className="text-lg font-extrabold">{calcs.responseTimeMin} Menit</span>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                    calcs.responseComply
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
                  }`}>
                    {calcs.responseComply ? 'COMPLY (Memenuhi)' : 'NOT COMPLY (Tidak Memenuhi)'}
                  </div>
                </div>
              )}

              {/* Photo Evidence slot */}
              <div>
                <label className="block text-sm text-slate-400 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Response Time *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                  {formData.photoResponse ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.photoResponse}
                        alt="Bukti Response"
                        className="h-44 object-contain mx-auto rounded-xl border border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoResponse: '' })}
                        className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-xl"
                        title="Hapus Bukti"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-300">Pilih berkas foto bukti</p>
                      <p className="text-xs text-slate-500 mt-1">Gunakan screenshot WhatsApp, log tiket, atau email masuk (Max 15MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'photoResponse')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Upload bukti respon"
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-red-600" />
                  Step 2: Bukti Foto Engineer Onsite Support
                </h3>
                <p className="text-slate-500 text-xs">Unggah foto bukti kedatangan atau kehadiran engineer di lokasi unit gangguan.</p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) / Foto Engineer Onsite *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                  {formData.photoEngineerOnsite ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.photoEngineerOnsite}
                        alt="Bukti Engineer Onsite"
                        className="h-44 object-contain mx-auto rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoEngineerOnsite: '' })}
                        className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-xl"
                        title="Hapus Bukti"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700">Pilih berkas foto bukti engineer onsite</p>
                      <p className="text-xs text-slate-500 mt-1">Gunakan foto selfie engineer, screenshot share-loc WA, atau log kehadiran (Max 15MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'photoEngineerOnsite')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Upload bukti engineer onsite"
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-red-600" />
                  Step 3: Onsite Principle Engineer SLA (OPE)
                </h3>
                <p className="text-slate-500 text-xs">Target kedatangan di lokasi (onsite) default adalah 120 Menit (2 Jam) dihitung sejak order dibuat.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Order Masuk (Time Order)</label>
                  <input
                    disabled
                    type="datetime-local"
                    value={formData.timeOrder}
                    title="Waktu Order Masuk"
                    placeholder="Waktu order masuk"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Aktual Tiba di Lokasi (Onsite) *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.actualTimeOnsite}
                      onChange={(e) => setFormData({ ...formData, actualTimeOnsite: e.target.value })}
                      title="Waktu Aktual Tiba di Lokasi"
                      placeholder="Pilih waktu onsite"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target (Menit)</label>
                  <input
                    type="number"
                    value={formData.targetOnsiteMin}
                    onChange={(e) => setFormData({ ...formData, targetOnsiteMin: parseInt(e.target.value) || 120 })}
                    title="Target Onsite Time"
                    placeholder="Contoh: 120"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                  />
                </div>
              </div>

              {formData.timeOrder && formData.actualTimeOnsite && (
                <div className={`p-4 rounded-xl border flex items-center justify-between transition ${
                  calcs.onsiteComply
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                    : 'bg-red-500/10 border-red-500/30 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <div>
                      <span className="text-xs uppercase font-bold block">Durasi Tiba Onsite</span>
                      <span className="text-lg font-extrabold">{calcs.onsiteTimeMin} Menit</span>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                    calcs.onsiteComply
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {calcs.onsiteComply ? 'COMPLY (Memenuhi)' : 'NOT COMPLY (Tidak Memenuhi)'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Kedatangan Onsite Principle *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                  {formData.photoOnsite ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.photoOnsite}
                        alt="Bukti Onsite"
                        className="h-44 object-contain mx-auto rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoOnsite: '' })}
                        className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-xl"
                        title="Hapus Bukti"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700">Pilih berkas foto bukti</p>
                      <p className="text-xs text-slate-500 mt-1">Gunakan foto selfie di depan unit, log absen, atau screenshot WA (Max 15MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'photoOnsite')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Upload bukti kedatangan"
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-600" />
                  Step 4: Restore Service Time SLA (RST)
                </h3>
                <p className="text-slate-500 text-xs">Target pemulihan layanan default adalah 180 Menit (3 Jam) dari mulainya pekerjaan.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Mulai Pekerjaan (Start Order) *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.startOrder}
                      onChange={(e) => setFormData({ ...formData, startOrder: e.target.value })}
                      title="Waktu Mulai Pekerjaan"
                      placeholder="Pilih waktu mulai"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Layanan Pulih (Finish Order) *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.finishOrder}
                      onChange={(e) => setFormData({ ...formData, finishOrder: e.target.value })}
                      title="Waktu Layanan Pulih"
                      placeholder="Pilih waktu selesai"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target (Menit)</label>
                  <input
                    type="number"
                    value={formData.targetRestoreMin}
                    onChange={(e) => setFormData({ ...formData, targetRestoreMin: parseInt(e.target.value) || 180 })}
                    title="Target Restore Time"
                    placeholder="Contoh: 180"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                  />
                </div>
              </div>

              {formData.startOrder && formData.finishOrder && (
                <div className={`p-4 rounded-xl border flex items-center justify-between transition ${
                  calcs.restoreComply
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                    : 'bg-red-500/10 border-red-500/30 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <div>
                      <span className="text-xs uppercase font-bold block">Durasi Pemulihan Layanan</span>
                      <span className="text-lg font-extrabold">{calcs.restoreTimeMin} Menit</span>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                    calcs.restoreComply
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {calcs.restoreComply ? 'COMPLY (Memenuhi)' : 'NOT COMPLY (Tidak Memenuhi)'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Layanan Pulih *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                  {formData.photoRestore ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.photoRestore}
                        alt="Bukti Restore"
                        className="h-44 object-contain mx-auto rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoRestore: '' })}
                        className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-xl"
                        title="Hapus Bukti"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700">Pilih berkas foto bukti</p>
                      <p className="text-xs text-slate-500 mt-1">Gunakan screenshot grafik sistem normal, log tiket pulih, atau chat WA (Max 15MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'photoRestore')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Upload bukti layanan pulih"
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-red-600" />
                  Step 5: Resolution Time SLA &amp; Ringkasan Laporan
                </h3>
                <p className="text-slate-500 text-xs">Target resolusi total default adalah 180 Menit (3 Jam) dari dimulainya pekerjaan.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target Resolusi (Menit)</label>
                  <input
                    type="number"
                    value={formData.targetResolutionMin}
                    onChange={(e) => setFormData({ ...formData, targetResolutionMin: parseInt(e.target.value) || 180 })}
                    title="Target Resolution Time"
                    placeholder="Contoh: 180"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                  />
                </div>

                {/* Photo Evidence slot */}
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Bukti Tangkapan Layar (Screenshot) Tiket Closed/Selesai *</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                    {formData.photoResolution ? (
                      <div className="relative inline-block">
                        <img
                          src={formData.photoResolution}
                          alt="Bukti Resolusi"
                          className="h-28 object-contain mx-auto rounded-xl border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photoResolution: '' })}
                          className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-xl"
                          title="Hapus Bukti"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-700">Pilih berkas foto bukti tiket closed</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'photoResolution')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Upload bukti penyelesaian"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Comprehensive SLA Review Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">Ringkasan Nilai &amp; Pencapaian SLA/SLG</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">1. Response Time</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.responseTimeMin} Menit</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-2 border ${
                      calcs.responseComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.responseComply ? 'COMPLY' : 'TM'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">2. Onsite OPE</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.onsiteTimeMin} Menit</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-2 border ${
                      calcs.onsiteComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.onsiteComply ? 'COMPLY' : 'TM'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">3. Restore RST</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.restoreTimeMin} Menit</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-2 border ${
                      calcs.restoreComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.restoreComply ? 'COMPLY' : 'TM'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">4. Resolution RT</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.resolutionTimeMin} Menit</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-2 border ${
                      calcs.resolutionComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.resolutionComply ? 'COMPLY' : 'TM'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
          {currentStep > 1 ? (
            <motion.button
              key="back-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleBack}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </motion.button>
          ) : (
            <button
              key="cancel-btn"
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition border border-slate-200 shadow-sm"
            >
              Batal
            </button>
          )}

          {currentStep < 5 ? (
            <motion.button
              key="next-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-red-500/10"
            >
              Lanjutkan
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await exportSLAReportToDocx(formData);
                    toast.success('Laporan SLA Word (DOCX) berhasil diekspor!');
                  } catch (err: any) {
                    console.error('Error exporting SLA DOCX:', err);
                    toast.error('Gagal mengekspor Laporan SLA Word');
                  }
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export DOCX
              </button>

              <motion.button
                key="submit-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan Laporan...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Simpan Laporan SLA
                  </>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
