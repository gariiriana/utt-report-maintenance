import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, ChevronUp, Eye, AlertTriangle, Edit2, Save, FileType
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/api/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';

import {
  ATSReportData, ATSCustomerInfo, ATSTimeSpent,
  DEFAULT_CUSTOMER_INFO, DEFAULT_REPORT_DATA, DEFAULT_TIME_SPENT,
  VisualInspectionItem
} from '@/types/atsReportTypes';
import { ATSServiceReportPreview } from './ATSServiceReportPreview';
import { generateATSServiceReportPDF } from '@/service_reports/ats/generateATSReportPDF';
import { generateATSReportExcel } from '@/service_reports/ats/generateATSReportExcel';
import { formatAIError } from '@/utils/aiErrorUtils';
import { draftStorage } from '@/utils/draftStorage';

// Helper to map card parameters to ATSServiceReport form fields
function mapCardParametersToReportData(
  originalReportCards: Array<{ description: string; parameter?: string }>,
  currentReportData: ATSReportData
): ATSReportData {
  const data = JSON.parse(JSON.stringify(currentReportData)) as ATSReportData;

  const extractLabel = (text: string, label: string): string => {
    const regex = new RegExp(`${label}\\s*[:=\\-\\s]\\s*([^,\\n]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  originalReportCards.forEach(card => {
    const desc = (card.description || '').toLowerCase();
    const val = (card.parameter || '').trim();
    if (!val) return;

    // Thermal
    if (desc.includes('thermal') || desc.includes('imager') || desc.includes('suhu') || desc.includes('temp')) {
      data.thermal_measurement.result_temperature = val;
    }
    // Grounding
    else if (desc.includes('grounding') || desc.includes('tahanan') || desc.includes('earth') || desc.includes('resistance')) {
      data.grounding_resistance.result_ohm = val;
    }
    // Voltage R-S
    else if (desc.includes('voltage r - s') || desc.includes('voltage r-s')) {
      data.voltage_current.voltage_rs = val;
      data.power_meter_recording.rs.voltage = val;
    }
    // Voltage S-T
    else if (desc.includes('voltage s - t') || desc.includes('voltage s-t')) {
      data.voltage_current.voltage_st = val;
      data.power_meter_recording.st.voltage = val;
    }
    // Voltage T-R
    else if (desc.includes('voltage t - r') || desc.includes('voltage t-r')) {
      data.voltage_current.voltage_tr = val;
      data.power_meter_recording.tr.voltage = val;
    }
    // Voltage R-N
    else if (desc.includes('voltage r - n') || desc.includes('voltage r-n')) {
      data.voltage_current.voltage_rn = val;
      data.power_meter_recording.rn.voltage = val;
    }
    // Voltage S-N
    else if (desc.includes('voltage s - n') || desc.includes('voltage s-n')) {
      data.voltage_current.voltage_sn = val;
      data.power_meter_recording.sn.voltage = val;
    }
    // Voltage T-N
    else if (desc.includes('voltage t - n') || desc.includes('voltage t-n')) {
      data.voltage_current.voltage_tn = val;
      data.power_meter_recording.tn.voltage = val;
    }
    // Voltage N-G
    else if (desc.includes('voltage n - g') || desc.includes('voltage n-g')) {
      data.voltage_current.voltage_ng = val;
      data.power_meter_recording.n.voltage = val;
    }
    // Ampere R
    else if (desc.includes('ampere r') || desc.includes('current r')) {
      data.voltage_current.ampere_r = val;
      data.power_meter_recording.r_ampere = val;
    }
    // Ampere S
    else if (desc.includes('ampere s') || desc.includes('current s')) {
      data.voltage_current.ampere_s = val;
      data.power_meter_recording.s_ampere = val;
    }
    // Ampere T
    else if (desc.includes('ampere t') || desc.includes('current t')) {
      data.voltage_current.ampere_t = val;
      data.power_meter_recording.t_ampere = val;
    }
    // Ampere N
    else if (desc.includes('ampere n') || desc.includes('current n')) {
      data.power_meter_recording.n_ampere = val;
    }
    // DPM Voltage
    else if (desc.includes('voltage dpm')) {
      const rs = extractLabel(val, 'RS') || extractLabel(val, 'R-S');
      const st = extractLabel(val, 'ST') || extractLabel(val, 'S-T');
      const tr = extractLabel(val, 'TR') || extractLabel(val, 'T-R');
      const rn = extractLabel(val, 'RN') || extractLabel(val, 'R-N');
      const sn = extractLabel(val, 'SN') || extractLabel(val, 'S-N');
      const tn = extractLabel(val, 'TN') || extractLabel(val, 'T-N');
      const n = extractLabel(val, 'N');

      if (rs) data.power_meter_recording.rs.voltage = rs;
      if (st) data.power_meter_recording.st.voltage = st;
      if (tr) data.power_meter_recording.tr.voltage = tr;
      if (rn) data.power_meter_recording.rn.voltage = rn;
      if (sn) data.power_meter_recording.sn.voltage = sn;
      if (tn) data.power_meter_recording.tn.voltage = tn;
      if (n) data.power_meter_recording.n.voltage = n;

      if (!rs && !st && !tr && !rn && !sn && !tn) {
        const parts = val.split(/[,;\s]+/);
        if (parts.length >= 3) {
          if (desc.includes('line') || !data.power_meter_recording.rs.voltage) {
            data.power_meter_recording.rs.voltage = parts[0];
            data.power_meter_recording.st.voltage = parts[1];
            data.power_meter_recording.tr.voltage = parts[2];
          } else {
            data.power_meter_recording.rn.voltage = parts[0];
            data.power_meter_recording.sn.voltage = parts[1];
            data.power_meter_recording.tn.voltage = parts[2];
            if (parts[3]) data.power_meter_recording.n.voltage = parts[3];
          }
        }
      }
    }
    // DPM Ampere
    else if (desc.includes('ampere dpm') || desc.includes('current dpm')) {
      const r = extractLabel(val, 'R');
      const s = extractLabel(val, 'S');
      const t = extractLabel(val, 'T');
      const n = extractLabel(val, 'N');

      if (r) data.power_meter_recording.r_ampere = r;
      if (s) data.power_meter_recording.s_ampere = s;
      if (t) data.power_meter_recording.t_ampere = t;
      if (n) data.power_meter_recording.n_ampere = n;

      if (!r && !s && !t) {
        const parts = val.split(/[,;\s]+/);
        if (parts.length >= 3) {
          data.power_meter_recording.r_ampere = parts[0];
          data.power_meter_recording.s_ampere = parts[1];
          data.power_meter_recording.t_ampere = parts[2];
          if (parts[3]) data.power_meter_recording.n_ampere = parts[3];
        }
      }
    }
    // DPM Daya
    else if (desc.includes('daya dpm') || desc.includes('power dpm')) {
      const kw = extractLabel(val, 'KW') || extractLabel(val, 'kW');
      const kva = extractLabel(val, 'KVA') || extractLabel(val, 'kVA');
      const kvar = extractLabel(val, 'KVAR') || extractLabel(val, 'kVAR');
      const cos_p = extractLabel(val, 'cos p') || extractLabel(val, 'cos phi') || extractLabel(val, 'pf') || extractLabel(val, 'cos_p') || extractLabel(val, 'cos_phi');

      if (kw) data.power_meter_recording.kw = kw;
      if (kva) data.power_meter_recording.kva = kva;
      if (kvar) data.power_meter_recording.kvar = kvar;
      if (cos_p) data.power_meter_recording.cos_p = cos_p;

      if (!kw && !kva && !kvar && !cos_p) {
        const parts = val.split(/[,;\s]+/);
        if (parts.length >= 4) {
          data.power_meter_recording.kw = parts[0];
          data.power_meter_recording.kva = parts[1];
          data.power_meter_recording.kvar = parts[2];
          data.power_meter_recording.cos_p = parts[3];
        }
      }
    }
  });

  return data;
}

type PhotoCategory = 'visual_inspection' | 'power_meter' | 'thermal' | 'grounding';

interface UploadedPhoto {
  id: string;
  file: File;
  base64: string;
  preview: string;
  category: PhotoCategory;
  label: string;
  parameter?: string;
}

const CATEGORY_CONFIG: Record<PhotoCategory, { label: string; description: string; color: string; icon: string }> = {
  visual_inspection: { label: 'Inspeksi Visual', description: 'Foto panel ATS, enclosure, wiring, busbar, indicator', color: 'from-blue-500 to-blue-600', icon: '🔍' },
  power_meter: { label: 'Meteran Listrik (Power Meter)', description: 'Foto display digital power meter (voltage, current, power)', color: 'from-amber-500 to-orange-600', icon: '⚡' },
  thermal: { label: 'Pencitraan Termal', description: 'Foto thermal imager menunjukkan suhu', color: 'from-red-500 to-rose-600', icon: '🌡️' },
  grounding: { label: 'Pentanahan (Grounding)', description: 'Foto pengukuran resistansi grounding', color: 'from-green-500 to-emerald-600', icon: '⏚' },
};

interface ATSServiceReportProps {
  prefillData?: {
    maintenanceName: string;
    maintenanceTime: string;
    specificDetail: string;
    photos: Array<{ base64: string; category: string; label: string; preview: string; parameter?: string }>;
    originalReportCards: Array<{ photoBase64?: string; description: string; parameter?: string }>;
    autoTrigger?: boolean;
    triggerGenerateData?: boolean;
    atsCustomerInfo?: ATSCustomerInfo;
    atsReportData?: ATSReportData;
    atsTimeSpent?: ATSTimeSpent;
    archiveId?: string;
    archiveType?: string;
  } | null;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: ATSCustomerInfo; reportData: ATSReportData; timeSpent: ATSTimeSpent }) => void;
}

const mergeWithDefaults = (info: Partial<ATSCustomerInfo>): ATSCustomerInfo => {
  const merged = { ...DEFAULT_CUSTOMER_INFO };
  (Object.keys(DEFAULT_CUSTOMER_INFO) as Array<keyof ATSCustomerInfo>).forEach((k) => {
    const val = info[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      merged[k] = val as any;
    }
  });
  return merged;
};

const getQuarterFromDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 11 = Dec
  if (month >= 0 && month <= 2) return 'Q1';
  if (month >= 3 && month <= 5) return 'Q2';
  if (month >= 6 && month <= 8) return 'Q3';
  return 'Q4';
};

export function ATSServiceReport({ prefillData, onClearPrefill, onChange }: ATSServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<ATSCustomerInfo>({ ...DEFAULT_CUSTOMER_INFO });
  const [reportData, setReportData] = useState<ATSReportData>({ ...DEFAULT_REPORT_DATA });
  const [timeSpent, setTimeSpent] = useState<ATSTimeSpent>({ ...DEFAULT_TIME_SPENT });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [originalReportCards, setOriginalReportCards] = useState<Array<{ photoBase64?: string; description: string; parameter?: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: true, photos: true, visual: false, power: false,
    voltage: false, thermal: false, grounding: false, operation: false, time: false,
  });
  const [isDraftLoading, setIsDraftLoading] = useState(true);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiveType, setArchiveType] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiLimit, setAiLimit] = useState<{ total: number; used: number } | null>(null);

  useEffect(() => {
    // Listen to AI request quota in Firestore
    const unsubscribe = onSnapshot(doc(db, 'system_status', 'ai_limit_tracker'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAiLimit({
          total: Number(data.total_limit) || 6000,
          used: Number(data.used_today) || 0,
        });
      } else {
        setAiLimit({ total: 6000, used: 0 });
      }
    }, (error) => {
      console.error('Failed to listen to AI limit tracker:', error);
    });

    return () => unsubscribe();
  }, []);

  const generateReportWithAI = async (
    currentPhotos: UploadedPhoto[],
    currentReportData: ATSReportData
  ) => {
    setIsGenerating(true);
    const toastId = toast.loading('✨ AI sedang menyusun Service Report ATS secara lengkap...');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Silakan login terlebih dahulu');

      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = apiBaseUrl.endsWith('/api')
        ? `${apiBaseUrl}/ai/ats-report`
        : `${apiBaseUrl}/api/ai/ats-report`;

      // Map photos to the backend model format (Category, Label, Parameter)
      // We prioritize originalReportCards as they represent the full checklist and inputs
      const payloadPhotos = originalReportCards.length > 0
        ? originalReportCards.map(c => {
          const desc = c.description || '';
          const d = desc.toLowerCase();
          let category = 'visual_inspection';
          if (d.includes('thermal') || d.includes('imager') || d.includes('suhu') || d.includes('temp')) {
            category = 'thermal';
          } else if (d.includes('grounding') || d.includes('earth') || d.includes('tahanan')) {
            category = 'grounding';
          } else if (
            d.includes('voltage') || d.includes('ampere') || d.includes('current') ||
            d.includes('dpm') || d.includes('power') || d.includes('daya') ||
            d.includes('r-s') || d.includes('s-t') || d.includes('t-r') ||
            d.includes('r-n') || d.includes('s-n') || d.includes('t-n')
          ) {
            category = 'power_meter';
          }
          return {
            category,
            label: desc,
            parameter: c.parameter || ''
          };
        })
        : currentPhotos.map(p => ({
          category: p.category,
          label: p.label,
          parameter: p.parameter || ''
        }));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photos: payloadPhotos,
          report_data: currentReportData
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data) {
        setReportData(data);
        toast.success('✨ AI berhasil mengisi data, kondisi, dan keterangan laporan!', { id: toastId });
        return data;
      } else {
        throw new Error('AI returned empty response');
      }
    } catch (err: any) {
      console.error('AI Report Generation failed:', err);
      toast.error(`AI Auto-Fill gagal: ${formatAIError(err)}`, { id: toastId });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Load draft from draftStorage (IndexedDB)
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await draftStorage.get('ats_service_report_draft');
        if (saved) {
          if (saved.customerInfo) setCustomerInfo(mergeWithDefaults(saved.customerInfo));
          if (saved.reportData) setReportData(saved.reportData);
          if (saved.timeSpent) setTimeSpent(saved.timeSpent);
          if (saved.photos) setPhotos(saved.photos);
          if (saved.originalReportCards) setOriginalReportCards(saved.originalReportCards);
        }
      } catch (err) {
        console.error('Failed to load ATS service report draft:', err);
      } finally {
        setIsDraftLoading(false);
      }
    };
    loadDraft();
  }, []);

  // Autosave draft to draftStorage (IndexedDB)
  useEffect(() => {
    if (isDraftLoading) return;
    const saveDraft = async () => {
      try {
        await draftStorage.set('ats_service_report_draft', {
          customerInfo,
          reportData,
          timeSpent,
          photos,
          originalReportCards
        });
      } catch (err) {
        console.error('Failed to save ATS service report draft:', err);
      }
    };
    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [customerInfo, reportData, timeSpent, photos, originalReportCards, isDraftLoading]);

  // Notify parent of state changes
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };





  const removePhoto = (id: string) => {
    setPhotoToDelete(id);
  };

  const confirmDeletePhoto = () => {
    if (photoToDelete) {
      setPhotos(prev => prev.filter(p => p.id !== photoToDelete));
      setPhotoToDelete(null);
      toast.success('Foto berhasil dihapus');
    }
  };

  const editPhotoLabel = (id: string, currentLabel: string) => {
    const newLabel = window.prompt('Ubah deskripsi/label foto ini (akan membantu AI membaca foto lebih akurat):', currentLabel);
    if (newLabel !== null) {
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, label: newLabel } : p));
      toast.success('Deskripsi foto berhasil diperbarui');
    }
  };


  // Prefill side-effect
  useEffect(() => {
    if (prefillData) {
      if (prefillData.archiveId) setArchiveId(prefillData.archiveId);
      if (prefillData.archiveType) setArchiveType(prefillData.archiveType);

      if (prefillData.atsCustomerInfo) {
        setCustomerInfo(mergeWithDefaults(prefillData.atsCustomerInfo));
      } else {
        const computedQuarter = prefillData.maintenanceTime ? getQuarterFromDate(prefillData.maintenanceTime) : '';
        setCustomerInfo(prev => mergeWithDefaults({
          ...prev,
          ciName: prefillData.specificDetail || prev.ciName,
          date: prefillData.maintenanceTime ? prefillData.maintenanceTime.split('T')[0] : prev.date,
          quarter: computedQuarter || prev.quarter,
        }));
      }

      if (prefillData.atsTimeSpent) {
        setTimeSpent(prefillData.atsTimeSpent);
      } else {
        setTimeSpent(prev => ({
          ...prev,
          date: prefillData.maintenanceTime ? prefillData.maintenanceTime.split('T')[0] : prev.date,
        }));
      }

      if (prefillData.atsReportData) {
        setReportData(prefillData.atsReportData);
      }

      setOriginalReportCards(prefillData.originalReportCards || []);

      const mappedPhotos = prefillData.photos.map((p, i) => ({
        id: `prefill_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        file: new File([], p.label || 'image.jpg'),
        base64: p.base64,
        preview: p.preview,
        category: p.category as PhotoCategory,
        label: p.label || '',
        parameter: p.parameter || '',
      }));
      setPhotos(mappedPhotos);

      if (prefillData.triggerGenerateData) {
        const cardsForMapping = prefillData.originalReportCards.map((c, i) => ({
          id: String(i + 1),
          photo: null,
          description: c.description || '',
          parameter: c.parameter || ''
        }));

        // Map basic parameters first
        const initialMappedData = mapCardParametersToReportData(cardsForMapping, reportData);
        setReportData(initialMappedData);

        setExpandedSections(prev => ({
          ...prev,
          visual: true,
          power: true,
          voltage: true,
          thermal: true,
          grounding: true,
          operation: true
        }));

        toast.success('Mengekstrak parameter ke kolom data di bawah!');

        // Trigger AI analysis to generate visual inspection condition and remarks
        generateReportWithAI(mappedPhotos, initialMappedData);
      }

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  // ─── Export PDF ───────────────────────────────────────────────────────
  const handleExportPDF = async (overrideReportData?: ATSReportData) => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Sedang memproses dan meng-export PDF...');
    try {
      const dataToExport = overrideReportData || reportData;
      await generateATSServiceReportPDF(customerInfo, dataToExport, timeSpent, originalReportCards);

      if (archiveId) {
        const effectiveDocType = archiveType || 'pdf';
        const collectionName = effectiveDocType === 'excel' ? 'excel_documents' : (effectiveDocType === 'hse' ? 'hse' : 'pdf_documents');

        const docRef = doc(db, collectionName, archiveId);
        await updateDoc(docRef, {
          atsCustomerInfo: customerInfo,
          atsReportData: dataToExport,
          atsTimeSpent: timeSpent
        });
        toast.success('PDF berhasil diekspor & divalidasi ke arsip!', { id: toastId });
      } else {
        toast.success('PDF berhasil diekspor!', { id: toastId });
      }
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(`PDF export gagal: ${error.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Listen to AI Agent commands from Chat Widget ───────────────────
  useEffect(() => {
    const handleAgentCommand = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const action = detail?.action;

      if (action === 'AUTO_FILL_ATS' || action === 'AUTO_FILL_AND_EXPORT_ATS') {
        // 1. Run AI auto-fill
        toast.info('🚀 AI Agent: Memulai auto-fill parameter laporan...');
        const generatedData = await generateReportWithAI(photos, reportData);

        // 2. If it is both auto-fill AND export
        if (action === 'AUTO_FILL_AND_EXPORT_ATS' && generatedData) {
          toast.info('🚀 AI Agent: Menyiapkan ekspor PDF...');
          setTimeout(() => {
            handleExportPDF(generatedData);
          }, 1500);
        }
      } else if (action === 'EXPORT_PDF_ATS') {
        toast.info('🚀 AI Agent: Memulai proses ekspor PDF...');
        handleExportPDF();
      }
    };

    window.addEventListener('ai-agent-command', handleAgentCommand);
    return () => {
      window.removeEventListener('ai-agent-command', handleAgentCommand);
    };
  }, [photos, reportData, customerInfo, timeSpent, originalReportCards, isExporting, isGenerating]);

  // ─── Save to Firestore Archive ─────────────────────────────────────────
  const handleSaveArchive = async () => {
    if (!archiveId || isSaving) return;
    setIsSaving(true);
    const toastId = toast.loading('Menyimpan Service Report ke arsip...');
    try {
      const effectiveDocType = archiveType || 'pdf';
      const collectionName = effectiveDocType === 'excel' ? 'excel_documents' : (effectiveDocType === 'hse' ? 'hse' : 'pdf_documents');

      const docRef = doc(db, collectionName, archiveId);
      await updateDoc(docRef, {
        atsCustomerInfo: customerInfo,
        atsReportData: reportData,
        atsTimeSpent: timeSpent
      });

      toast.success('Service Report berhasil disimpan ke arsip!', { id: toastId });
    } catch (error: any) {
      console.error('Save to archive error:', error);
      toast.error(`Gagal menyimpan: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (showPreview) {
    return createPortal(
      <ATSServiceReportPreview
        customerInfo={customerInfo}
        reportData={reportData}
        timeSpent={timeSpent}
        originalReportCards={originalReportCards}
        onBack={() => setShowPreview(false)}
        onExportPDF={handleExportPDF}
      />,
      document.body
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 backdrop-blur-xl border border-sky-100/90 rounded-2xl p-4 sm:p-6 shadow-xl shadow-sky-900/5"
      >
        <div className="mb-2">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Service Report — ATS</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Automatic Transfer Switch • Neutra DC Cikarang</p>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Laporan pemeliharaan rutin Automatic Transfer Switch (ATS) di Neutra DC Cikarang.
        </p>

        {aiLimit && (
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
                🤖 Kuota AI Global
              </span>
              <span className="text-xs font-mono text-slate-600 font-medium">
                {Math.max(0, aiLimit.total - aiLimit.used).toLocaleString()} / {aiLimit.total.toLocaleString()} request tersisa hari ini
              </span>
            </div>
            <div className="w-full sm:w-48 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, ((aiLimit.total - aiLimit.used) / aiLimit.total) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ─── Section: Customer Info ──────────────────────────────── */}
      <CollapsibleSection title="Informasi Pelanggan" sectionKey="customer" expanded={expandedSections.customer} toggle={toggleSection} icon="📋" badge="Manual">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InputField label="Nama Perusahaan" value={customerInfo.companyName} onChange={v => setCustomerInfo(p => ({ ...p, companyName: v }))} />
          <InputField label="Nama Perangkat" value={customerInfo.equipmentName} onChange={v => setCustomerInfo(p => ({ ...p, equipmentName: v }))} />
          <InputField label="Deskripsi CI" value={customerInfo.ciDescription} onChange={v => setCustomerInfo(p => ({ ...p, ciDescription: v }))} />
          <InputField label="Nama CI" value={customerInfo.ciName} onChange={v => setCustomerInfo(p => ({ ...p, ciName: v }))} />
          <InputField label="Tipe" value={customerInfo.type} onChange={v => setCustomerInfo(p => ({ ...p, type: v }))} />
          <InputField label="No. Seri" value={customerInfo.serialNo} onChange={v => setCustomerInfo(p => ({ ...p, serialNo: v }))} />
          <InputField label="Nama Produk" value={customerInfo.productName} onChange={v => setCustomerInfo(p => ({ ...p, productName: v }))} />
          <InputField label="Tahun Produk" value={customerInfo.productYears} onChange={v => setCustomerInfo(p => ({ ...p, productYears: v }))} />
          <InputField label="Spesifikasi" value={customerInfo.specification} onChange={v => setCustomerInfo(p => ({ ...p, specification: v }))} />
          <InputField label="Lokasi" value={customerInfo.location} onChange={v => setCustomerInfo(p => ({ ...p, location: v }))} />
          <InputField label="Area" value={customerInfo.area} onChange={v => setCustomerInfo(p => ({ ...p, area: v }))} />
          <InputField label="No. Peta" value={customerInfo.mapNo} onChange={v => setCustomerInfo(p => ({ ...p, mapNo: v }))} />
          <InputField label="Kuartal" value={customerInfo.quarter} onChange={v => setCustomerInfo(p => ({ ...p, quarter: v }))} placeholder="Q1 / Q2 / Q3 / Q4" />
          <InputField label="Tanggal" value={customerInfo.date} onChange={v => setCustomerInfo(p => ({ ...p, date: v }))} type="date" />
          <InputField label="Teknisi" value={customerInfo.engineer} onChange={v => setCustomerInfo(p => ({ ...p, engineer: v }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Photo Upload ───────────────────────────────── */}
      <CollapsibleSection title="Foto Dokumentasi" sectionKey="photos" expanded={expandedSections.photos} toggle={toggleSection} icon="📷" badge={`${photos.length} foto`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(CATEGORY_CONFIG) as PhotoCategory[]).map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const catPhotos = photos.filter(p => p.category === cat);
            return (
              <div key={cat} className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{cfg.label}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{cfg.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">{catPhotos.length}</span>
                </div>

                {/* Photo thumbnails */}
                {catPhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {catPhotos.map(photo => (
                      <PhotoThumbnail
                        key={photo.id}
                        photo={photo}
                        onPreview={() => setPreviewImage(photo.preview)}
                        onDelete={() => removePhoto(photo.id)}
                        onEditLabel={() => editPhotoLabel(photo.id, photo.label)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic py-1">
                    Tidak ada foto terklasifikasi
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </CollapsibleSection>

      {/* ─── Section: Visual Inspection ──────────────────────────── */}
      <CollapsibleSection title="Inspeksi & Pemeriksaan Visual" sectionKey="visual" expanded={expandedSections.visual} toggle={toggleSection} icon="🔍" badge="—">
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="px-3 py-2 text-left w-8">No</th>
                <th className="px-3 py-2 text-left">Aktivitas</th>
                <th className="px-3 py-2 text-left w-32">Parameter</th>
                <th className="px-3 py-2 text-center w-24">Kondisi</th>
                <th className="px-3 py-2 text-left w-28">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.visual_inspection.map((item, idx) => (
                <tr key={item.no} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-1.5 text-slate-500 font-bold font-mono">{item.no}.</td>
                  <td className="px-3 py-1.5 text-slate-900 font-bold text-[11px]">{item.activity}</td>
                  <td className="px-3 py-1.5">
                    <input
                      value={item.parameter}
                      onChange={e => updateVisualInspection(idx, 'parameter', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-900 font-medium focus:border-violet-500 focus:outline-none shadow-sm"
                      title="Parameter"
                      placeholder="Parameter"
                      aria-label="Parameter"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <select
                      value={item.condition}
                      onChange={e => updateVisualInspection(idx, 'condition', e.target.value)}
                      className={`w-full bg-white border rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none cursor-pointer shadow-sm ${item.condition === 'Good' ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800' : 'border-rose-300 bg-rose-50/70 text-rose-800'
                        }`}
                      title="Condition"
                      aria-label="Condition"
                    >
                      <option value="Good">Good</option>
                      <option value="Not Good">Not Good</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <textarea
                      value={item.remarks}
                      onChange={e => updateVisualInspection(idx, 'remarks', e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-900 font-medium focus:border-violet-500 focus:outline-none resize-none min-h-[36px] shadow-sm"
                      placeholder="Keterangan"
                      title="Keterangan"
                      aria-label="Keterangan"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* ─── Section: Digital Power Meter Recording ──────────────── */}
      <CollapsibleSection title="Pencatatan Digital Power Meter" sectionKey="power" expanded={expandedSections.power} toggle={toggleSection} icon="⚡" badge="—">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['rs', 'st', 'tr', 'rn', 'sn', 'tn', 'n'] as const).map(wire => (
            <div key={wire} className="space-y-1">
              <label className="text-[10px] uppercase text-slate-700 font-bold">{wire.toUpperCase()} Voltage</label>
              <input
                value={reportData.power_meter_recording[wire].voltage}
                onChange={e => updatePowerMeter(wire, e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-900 font-mono font-medium focus:border-amber-500 focus:outline-none shadow-sm"
                placeholder="—"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
          <MeasurementInput label="KW" value={reportData.power_meter_recording.kw} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kw: v } }))} />
          <MeasurementInput label="KVA" value={reportData.power_meter_recording.kva} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kva: v } }))} />
          <MeasurementInput label="KVAR" value={reportData.power_meter_recording.kvar} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kvar: v } }))} />
          <MeasurementInput label="Cos p" value={reportData.power_meter_recording.cos_p} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, cos_p: v } }))} />
          <MeasurementInput label="Ampere R" value={reportData.power_meter_recording.r_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, r_ampere: v } }))} />
          <MeasurementInput label="Ampere S" value={reportData.power_meter_recording.s_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, s_ampere: v } }))} />
          <MeasurementInput label="Ampere T" value={reportData.power_meter_recording.t_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, t_ampere: v } }))} />
          <MeasurementInput label="Ampere N" value={reportData.power_meter_recording.n_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, n_ampere: v } }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
          <MeasurementInput label="Keterangan DPM R-S / KW / R" value={reportData.power_meter_recording.rs.remarks} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, rs: { ...p.power_meter_recording.rs, remarks: v } } }))} />
          <MeasurementInput label="Keterangan DPM S-T / KVA / S" value={reportData.power_meter_recording.st.remarks} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, st: { ...p.power_meter_recording.st, remarks: v } } }))} />
          <MeasurementInput label="Keterangan DPM T-R / KVAR / T" value={reportData.power_meter_recording.tr.remarks} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, tr: { ...p.power_meter_recording.tr, remarks: v } } }))} />
          <MeasurementInput label="Keterangan DPM N / Cos p / Netral" value={reportData.power_meter_recording.n.remarks} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, n: { ...p.power_meter_recording.n, remarks: v } } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Voltage & Current Measurement ──────────────── */}
      <CollapsibleSection title="Pengukuran Tegangan & Arus" sectionKey="voltage" expanded={expandedSections.voltage} toggle={toggleSection} icon="🔌" badge="—">
        <p className="text-[10px] text-slate-500 font-medium mb-3">Standard: +5% - 10% from 380V & 220V load deviation 10%</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MeasurementInput label="Voltage R-S" value={reportData.voltage_current.voltage_rs} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_rs: v } }))} />
          <MeasurementInput label="Voltage S-T" value={reportData.voltage_current.voltage_st} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_st: v } }))} />
          <MeasurementInput label="Voltage T-R" value={reportData.voltage_current.voltage_tr} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_tr: v } }))} />
          <MeasurementInput label="Voltage R-N" value={reportData.voltage_current.voltage_rn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_rn: v } }))} />
          <MeasurementInput label="Voltage S-N" value={reportData.voltage_current.voltage_sn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_sn: v } }))} />
          <MeasurementInput label="Voltage T-N" value={reportData.voltage_current.voltage_tn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_tn: v } }))} />
          <MeasurementInput label="Voltage N-G" value={reportData.voltage_current.voltage_ng} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_ng: v } }))} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
          <MeasurementInput label="Ampere R" value={reportData.voltage_current.ampere_r} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_r: v } }))} />
          <MeasurementInput label="Ampere S" value={reportData.voltage_current.ampere_s} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_s: v } }))} />
          <MeasurementInput label="Ampere T" value={reportData.voltage_current.ampere_t} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_t: v } }))} />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <MeasurementInput label="Keterangan Pengukuran Tegangan & Arus" value={reportData.voltage_current.remarks} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, remarks: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Thermal Measurement ────────────────────────── */}
      <CollapsibleSection title="Pengukuran Termal" sectionKey="thermal" expanded={expandedSections.thermal} toggle={toggleSection} icon="🌡️" badge="—">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MeasurementInput label="Suhu Hasil Pengukuran (°C)" value={reportData.thermal_measurement.result_temperature} onChange={v => setReportData(p => ({ ...p, thermal_measurement: { ...p.thermal_measurement, result_temperature: v } }))} />
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-700 font-bold">Standard</label>
            <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-mono font-bold shadow-sm">40°C</div>
          </div>
          <MeasurementInput label="Keterangan" value={reportData.thermal_measurement.remarks} onChange={v => setReportData(p => ({ ...p, thermal_measurement: { ...p.thermal_measurement, remarks: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Grounding Resistance ────────────────────────── */}
      <CollapsibleSection title="Pengukuran Resistansi Grounding" sectionKey="grounding" expanded={expandedSections.grounding} toggle={toggleSection} icon="⏚" badge="—">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MeasurementInput label="Hasil (Ω)" value={reportData.grounding_resistance.result_ohm} onChange={v => setReportData(p => ({ ...p, grounding_resistance: { ...p.grounding_resistance, result_ohm: v } }))} />
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-700 font-bold">Standard</label>
            <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-mono font-bold shadow-sm">{'<5 Ω'}</div>
          </div>
          <MeasurementInput label="Keterangan" value={reportData.grounding_resistance.remarks} onChange={v => setReportData(p => ({ ...p, grounding_resistance: { ...p.grounding_resistance, remarks: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Operation Status ────────────────────────────── */}
      <CollapsibleSection title="Status Operasi" sectionKey="operation" expanded={expandedSections.operation} toggle={toggleSection} icon="⚙️" badge="—">
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={reportData.operation_status.is_normal} onChange={() => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, is_normal: true } }))} className="accent-emerald-600" />
              <span className="text-sm text-emerald-700 font-bold">Operasi Normal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!reportData.operation_status.is_normal} onChange={() => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, is_normal: false } }))} className="accent-rose-600" />
              <span className="text-sm text-rose-700 font-bold">Operasi Abnormal</span>
            </label>
          </div>
          {reportData.operation_status.is_normal ? (
            <MeasurementInput label="Keterangan" value={reportData.operation_status.remark} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, remark: v } }))} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MeasurementInput label="Gejala Kerusakan" value={reportData.operation_status.fault_symptom} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_symptom: v } }))} />
              <MeasurementInput label="Analisis Kerusakan" value={reportData.operation_status.fault_analysis} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_analysis: v } }))} />
              <MeasurementInput label="Tindakan / Pekerjaan yang Dilakukan" value={reportData.operation_status.work_done} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, work_done: v } }))} />
              <MeasurementInput label="No. Seri Komponen Rusak" value={reportData.operation_status.fault_part_sn} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_part_sn: v } }))} />
              <MeasurementInput label="Nama Komponen Rusak" value={reportData.operation_status.fault_part_name} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_part_name: v } }))} />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ─── Section: Time Spent ──────────────────────────────────── */}
      <CollapsibleSection title="Waktu Pengerjaan" sectionKey="time" expanded={expandedSections.time} toggle={toggleSection} icon="⏱️">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="Tanggal" value={timeSpent.date} onChange={v => setTimeSpent(p => ({ ...p, date: v }))} type="date" />
          <InputField label="Keberangkatan" value={timeSpent.departure} onChange={v => setTimeSpent(p => ({ ...p, departure: v }))} type="time" />
          <InputField label="Mulai" value={timeSpent.start} onChange={v => setTimeSpent(p => ({ ...p, start: v }))} type="time" />
          <InputField label="Selesai" value={timeSpent.finish} onChange={v => setTimeSpent(p => ({ ...p, finish: v }))} type="time" />
        </div>
      </CollapsibleSection>

      {/* ─── Action Buttons ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowPreview(true)}
          className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          Pratinjau Service Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateATSReportExcel(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.preview, description: p.label })))}
          className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
        >
          <FileType className="w-4 h-4" />
          EXPORT EXCEL
        </motion.button>
        <motion.button
          whileHover={!isExporting ? { scale: 1.02 } : undefined}
          whileTap={!isExporting ? { scale: 0.98 } : undefined}
          onClick={() => handleExportPDF()}
          disabled={isExporting}
          className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all ${isExporting ? 'opacity-60 cursor-not-allowed' : ''
            }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Mengekspor...
            </>
          ) : (
            <>
              <FileType className="w-4 h-4" />
              GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
            </>
          )}
        </motion.button>
        {archiveId && (
          <motion.button
            whileHover={!isSaving ? { scale: 1.02 } : undefined}
            whileTap={!isSaving ? { scale: 0.98 } : undefined}
            onClick={handleSaveArchive}
            disabled={isSaving}
            className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all ${isSaving ? 'opacity-60 cursor-not-allowed' : ''
              }`}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Arsip Service Report
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Lightbox / Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-4xl w-full max-h-[85vh] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 p-2 bg-slate-900/80 border border-white/10 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors"
                title="Tutup preview"
                aria-label="Tutup preview"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[80vh] rounded-lg border border-white/10 object-contain shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Deletion Confirmation Modal */}
      <AnimatePresence>
        {photoToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPhotoToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900/95 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full relative overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPhotoToDelete(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                title="Tutup"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Hapus Foto?</h3>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  Apakah Anda yakin ingin menghapus foto ini dari lampiran laporan maintenance? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPhotoToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors border border-slate-700"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeletePhoto}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-red-600/20"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ─── Helper functions ────────────────────────────────────────────────
  function updateVisualInspection(index: number, field: keyof VisualInspectionItem, value: string) {
    setReportData(prev => {
      const updated = [...prev.visual_inspection];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, visual_inspection: updated };
    });
  }

  function updatePowerMeter(wire: 'rs' | 'st' | 'tr' | 'rn' | 'sn' | 'tn' | 'n', value: string) {
    setReportData(prev => ({
      ...prev,
      power_meter_recording: {
        ...prev.power_meter_recording,
        [wire]: { ...prev.power_meter_recording[wire], voltage: value },
      },
    }));
  }
}

// ─── Reusable Sub-components ──────────────────────────────────────────

function CollapsibleSection({ title, sectionKey, expanded, toggle, icon, badge, children }: {
  title: string; sectionKey: string; expanded: boolean; toggle: (key: string) => void;
  icon?: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => toggle(sectionKey)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-bold text-slate-900">{title}</span>
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.includes('AI') ? 'bg-violet-100 text-violet-800 border border-violet-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>{badge}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="px-5 pb-5 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase text-slate-700 font-bold tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-sm font-medium"
      />
    </div>
  );
}

function MeasurementInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const isLongText = label.toLowerCase().includes('keterangan') ||
    label.toLowerCase().includes('gejala') ||
    label.toLowerCase().includes('analisis') ||
    label.toLowerCase().includes('tindakan') ||
    label.toLowerCase().includes('remarks') ||
    label.toLowerCase().includes('remark');

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase text-slate-700 font-bold">{label}</label>
      {isLongText ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={2}
          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none resize-none min-h-[50px] shadow-sm font-medium"
          placeholder="—"
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none shadow-sm font-medium"
          placeholder="—"
        />
      )}
    </div>
  );
}

// ─── Photo Thumbnail with React-driven hover ───────────────────────────

function PhotoThumbnail({ photo, onPreview, onDelete, onEditLabel }: {
  photo: { id: string; preview: string; label: string };
  onPreview: () => void;
  onDelete: () => void;
  onEditLabel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Photo */}
      <div
        className="relative w-20 h-20 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer"
        onClick={onPreview}
        title={photo.label ? `Deskripsi: ${photo.label}` : 'Klik untuk lihat foto'}
      >
        <img src={photo.preview} alt={photo.label} className="w-full h-full object-cover" />
      </div>
      {/* Action buttons — always visible, bigger hit targets for mobile */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="p-1.5 sm:p-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-md transition-colors text-slate-700 border border-slate-200 cursor-pointer"
          title="Lihat foto"
          aria-label="Lihat foto"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEditLabel(); }}
          className="p-1.5 sm:p-1 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-md transition-colors text-amber-800 border border-amber-200 cursor-pointer"
          title="Edit deskripsi"
          aria-label="Edit deskripsi"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 sm:p-1 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-md transition-colors text-rose-700 border border-rose-200 cursor-pointer"
          title="Hapus foto"
          aria-label="Hapus foto"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

