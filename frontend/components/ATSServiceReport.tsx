import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Upload, X, Loader2,
  ChevronDown, ChevronUp, Download, Eye, AlertTriangle, Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '@/api/firebase';
import {
  ATSReportData, ATSCustomerInfo, ATSTimeSpent,
  DEFAULT_CUSTOMER_INFO, DEFAULT_REPORT_DATA, DEFAULT_TIME_SPENT,
  VisualInspectionItem
} from '@/types/atsReportTypes';
import { ATSServiceReportPreview } from './ATSServiceReportPreview';
import { generateATSServiceReportPDF } from '@/utils/ATSServiceReportPDF';
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
  visual_inspection: { label: 'Visual Inspection', description: 'Foto panel ATS, enclosure, wiring, busbar, indicator', color: 'from-blue-500 to-blue-600', icon: '🔍' },
  power_meter: { label: 'Power Meter', description: 'Foto display digital power meter (voltage, current, power)', color: 'from-amber-500 to-orange-600', icon: '⚡' },
  thermal: { label: 'Thermal Imager', description: 'Foto thermal imager menunjukkan suhu', color: 'from-red-500 to-rose-600', icon: '🌡️' },
  grounding: { label: 'Grounding', description: 'Foto measurement grounding resistance', color: 'from-green-500 to-emerald-600', icon: '⏚' },
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
  } | null;
  onClearPrefill?: () => void;
}

export function ATSServiceReport({ prefillData, onClearPrefill }: ATSServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<ATSCustomerInfo>({ ...DEFAULT_CUSTOMER_INFO });
  const [reportData, setReportData] = useState<ATSReportData>({ ...DEFAULT_REPORT_DATA });
  const [timeSpent, setTimeSpent] = useState<ATSTimeSpent>({ ...DEFAULT_TIME_SPENT });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [originalReportCards, setOriginalReportCards] = useState<Array<{ photoBase64?: string; description: string; parameter?: string }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: true, photos: true, visual: false, power: false,
    voltage: false, thermal: false, grounding: false, operation: false, time: false,
  });
  const [isDraftLoading, setIsDraftLoading] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load draft from draftStorage (IndexedDB)
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await draftStorage.get('ats_service_report_draft');
        if (saved) {
          if (saved.customerInfo) setCustomerInfo(saved.customerInfo);
          if (saved.reportData) setReportData(saved.reportData);
          if (saved.timeSpent) setTimeSpent(saved.timeSpent);
          if (saved.photos) setPhotos(saved.photos);
          if (saved.originalReportCards) setOriginalReportCards(saved.originalReportCards);
          setAiGenerated(true);
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

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };



  // ─── Photo Management ────────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async (files: FileList, category: PhotoCategory) => {
    const newPhotos: UploadedPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} terlalu besar (max 10MB)`);
        continue;
      }
      const base64 = await fileToBase64(file);
      newPhotos.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        file,
        base64: base64.split(',')[1], // Remove data:image/... prefix
        preview: base64,
        category,
        label: file.name.replace(/\.[^.]+$/, ''),
      });
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    toast.success(`${newPhotos.length} foto ditambahkan ke ${CATEGORY_CONFIG[category].label}`);
  }, []);

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

  // ─── AI Analysis ─────────────────────────────────────────────────────
  const handleAIGenerate = async (photosToAnalyze?: UploadedPhoto[]) => {
    const targetPhotos = photosToAnalyze || photos;
    
    setIsAnalyzing(true);
    setAnalysisProgress('Mengirim parameter & data ke Go backend...');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const payload = {
        photos: targetPhotos.map(p => ({
          base64: p.base64 || '',
          category: p.category,
          label: p.label,
          parameter: p.parameter || '',
        })),
        report_data: reportData,
      };

      setAnalysisProgress('AI sedang menganalisis data & membuat remark...');
      const response = await fetch('/api/ai/ats-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `Server error: ${response.status}`);
      }

      const result: ATSReportData = await response.json();
      setReportData(result);
      setAiGenerated(true);

      // Auto-expand sections
      setExpandedSections(prev => ({
        ...prev,
        visual: true, power: true, voltage: true,
        thermal: true, grounding: true, operation: true,
      }));

      toast.success('🤖 Generate Remark AI berhasil! Periksa & edit di bawah.');
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error(`AI analysis gagal: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // Use ref to hold AI generate function for useEffect
  const handleAIGenerateRef = useRef<any>(null);
  handleAIGenerateRef.current = handleAIGenerate;

  // Prefill side-effect
  useEffect(() => {
    if (prefillData) {
      setCustomerInfo(prev => ({
        ...prev,
        ciName: prefillData.maintenanceName || prev.ciName,
        date: prefillData.maintenanceTime ? prefillData.maintenanceTime.split('T')[0] : prev.date,
        specification: prefillData.specificDetail || prev.specification,
      }));
      
      setTimeSpent(prev => ({
        ...prev,
        date: prefillData.maintenanceTime ? prefillData.maintenanceTime.split('T')[0] : prev.date,
      }));

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
        setReportData(prev => {
          const cardsForMapping = prefillData.originalReportCards.map((c, i) => ({
            id: String(i + 1),
            photo: null,
            description: c.description || '',
            parameter: c.parameter || ''
          }));
          return mapCardParametersToReportData(cardsForMapping, prev);
        });

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
      }

      if (onClearPrefill) {
        onClearPrefill();
      }

      if (prefillData.autoTrigger) {
        setTimeout(() => {
          handleAIGenerateRef.current?.(mappedPhotos);
        }, 100);
      }
    }
  }, [prefillData, onClearPrefill]);

  // ─── Export PDF ───────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      await generateATSServiceReportPDF(customerInfo, reportData, timeSpent, originalReportCards);
      toast.success('PDF berhasil di-export!');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(`PDF export gagal: ${error.message}`);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (showPreview) {
    return (
      <ATSServiceReportPreview
        customerInfo={customerInfo}
        reportData={reportData}
        timeSpent={timeSpent}
        originalReportCards={originalReportCards}
        onBack={() => setShowPreview(false)}
        onExportPDF={handleExportPDF}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Service Report — ATS</h1>
            <p className="text-sm text-slate-400">Automatic Transfer Switch • Neutra DC Cikarang</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Upload foto panel ATS, power meter, thermal imager & grounding → AI akan menganalisis & mengisi semua field otomatis.
        </p>
      </motion.div>

      {/* ─── Section: Customer Info ──────────────────────────────── */}
      <CollapsibleSection title="Customer Information" sectionKey="customer" expanded={expandedSections.customer} toggle={toggleSection} icon="📋" badge="Manual">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InputField label="Company Name" value={customerInfo.companyName} onChange={v => setCustomerInfo(p => ({ ...p, companyName: v }))} />
          <InputField label="Equipment Name" value={customerInfo.equipmentName} onChange={v => setCustomerInfo(p => ({ ...p, equipmentName: v }))} />
          <InputField label="CI Description" value={customerInfo.ciDescription} onChange={v => setCustomerInfo(p => ({ ...p, ciDescription: v }))} />
          <InputField label="CI Name" value={customerInfo.ciName} onChange={v => setCustomerInfo(p => ({ ...p, ciName: v }))} />
          <InputField label="Type" value={customerInfo.type} onChange={v => setCustomerInfo(p => ({ ...p, type: v }))} />
          <InputField label="Serial No." value={customerInfo.serialNo} onChange={v => setCustomerInfo(p => ({ ...p, serialNo: v }))} />
          <InputField label="Product Name" value={customerInfo.productName} onChange={v => setCustomerInfo(p => ({ ...p, productName: v }))} />
          <InputField label="Product Years" value={customerInfo.productYears} onChange={v => setCustomerInfo(p => ({ ...p, productYears: v }))} />
          <InputField label="Specification" value={customerInfo.specification} onChange={v => setCustomerInfo(p => ({ ...p, specification: v }))} />
          <InputField label="Location" value={customerInfo.location} onChange={v => setCustomerInfo(p => ({ ...p, location: v }))} />
          <InputField label="Area" value={customerInfo.area} onChange={v => setCustomerInfo(p => ({ ...p, area: v }))} />
          <InputField label="Map No." value={customerInfo.mapNo} onChange={v => setCustomerInfo(p => ({ ...p, mapNo: v }))} />
          <InputField label="Quarter" value={customerInfo.quarter} onChange={v => setCustomerInfo(p => ({ ...p, quarter: v }))} placeholder="Q1 / Q2 / Q3 / Q4" />
          <InputField label="Date" value={customerInfo.date} onChange={v => setCustomerInfo(p => ({ ...p, date: v }))} type="date" />
          <InputField label="Engineer" value={customerInfo.engineer} onChange={v => setCustomerInfo(p => ({ ...p, engineer: v }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Photo Upload ───────────────────────────────── */}
      <CollapsibleSection title="Upload Foto" sectionKey="photos" expanded={expandedSections.photos} toggle={toggleSection} icon="📷" badge={`${photos.length} foto`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(CATEGORY_CONFIG) as PhotoCategory[]).map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const catPhotos = photos.filter(p => p.category === cat);
            return (
              <div key={cat} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{cfg.label}</p>
                      <p className="text-[10px] text-slate-500">{cfg.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{catPhotos.length}</span>
                </div>

                {/* Upload area */}
                <button
                  onClick={() => fileInputRefs.current[cat]?.click()}
                  className={`w-full border-2 border-dashed border-slate-600/50 hover:border-slate-500 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:bg-slate-700/20`}
                >
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-400">Klik untuk upload foto</span>
                </button>
                <input
                  ref={el => { fileInputRefs.current[cat] = el; }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handlePhotoUpload(e.target.files, cat)}
                  title="Upload Foto"
                  aria-label="Upload Foto"
                />

                {/* Photo thumbnails */}
                {catPhotos.length > 0 && (
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
                )}
              </div>
            );
          })}
        </div>

        {/* AI Generate Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleAIGenerate()}
          disabled={isAnalyzing}
          className={`w-full mt-4 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            isAnalyzing
              ? 'bg-slate-700 text-slate-400 cursor-wait'
              : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{analysisProgress || 'AI sedang membuat remark...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>🤖 Generate Remark (AI)</span>
            </>
          )}
        </motion.button>
      </CollapsibleSection>

      {/* ─── Section: Visual Inspection ──────────────────────────── */}
      <CollapsibleSection title="Visual Inspection & Check" sectionKey="visual" expanded={expandedSections.visual} toggle={toggleSection} icon="🔍" badge={aiGenerated ? '✅ AI' : '—'}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="bg-slate-800/60 text-slate-300">
                <th className="px-2 py-2 text-left w-8">No</th>
                <th className="px-2 py-2 text-left">Activity</th>
                <th className="px-2 py-2 text-left w-32">Parameter</th>
                <th className="px-2 py-2 text-center w-24">Condition</th>
                <th className="px-2 py-2 text-left w-28">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {reportData.visual_inspection.map((item, idx) => (
                <tr key={item.no} className="border-t border-slate-700/30 hover:bg-slate-800/20">
                  <td className="px-2 py-1.5 text-slate-400 font-mono">{item.no}.</td>
                  <td className="px-2 py-1.5 text-slate-300 text-[11px]">{item.activity}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={item.parameter}
                      onChange={e => updateVisualInspection(idx, 'parameter', e.target.value)}
                      className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-1.5 py-1 text-[11px] text-white focus:border-violet-500/50 focus:outline-none"
                      title="Parameter"
                      placeholder="Parameter"
                      aria-label="Parameter"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <select
                      value={item.condition}
                      onChange={e => updateVisualInspection(idx, 'condition', e.target.value)}
                      className={`w-full bg-slate-800/40 border rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none ${
                        item.condition === 'Good' ? 'border-green-500/40 text-green-400' : 'border-red-500/40 text-red-400'
                      }`}
                      title="Condition"
                      aria-label="Condition"
                    >
                      <option value="Good">Good</option>
                      <option value="Not Good">Not Good</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={item.remarks}
                      onChange={e => updateVisualInspection(idx, 'remarks', e.target.value)}
                      className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-1.5 py-1 text-[11px] text-white focus:border-violet-500/50 focus:outline-none"
                      placeholder="Remarks"
                      title="Remarks"
                      aria-label="Remarks"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* ─── Section: Digital Power Meter Recording ──────────────── */}
      <CollapsibleSection title="Digital Power Meter Recording" sectionKey="power" expanded={expandedSections.power} toggle={toggleSection} icon="⚡" badge={aiGenerated ? '✅ AI' : '—'}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['rs', 'st', 'tr', 'rn', 'sn', 'tn', 'n'] as const).map(wire => (
            <div key={wire} className="space-y-1">
              <label className="text-[10px] uppercase text-slate-500 font-bold">{wire.toUpperCase()} Voltage</label>
              <input
                value={reportData.power_meter_recording[wire].voltage}
                onChange={e => updatePowerMeter(wire, e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="—"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-700/30">
          <MeasurementInput label="KW" value={reportData.power_meter_recording.kw} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kw: v } }))} />
          <MeasurementInput label="KVA" value={reportData.power_meter_recording.kva} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kva: v } }))} />
          <MeasurementInput label="KVAR" value={reportData.power_meter_recording.kvar} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, kvar: v } }))} />
          <MeasurementInput label="Cos p" value={reportData.power_meter_recording.cos_p} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, cos_p: v } }))} />
          <MeasurementInput label="Ampere R" value={reportData.power_meter_recording.r_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, r_ampere: v } }))} />
          <MeasurementInput label="Ampere S" value={reportData.power_meter_recording.s_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, s_ampere: v } }))} />
          <MeasurementInput label="Ampere T" value={reportData.power_meter_recording.t_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, t_ampere: v } }))} />
          <MeasurementInput label="Ampere N" value={reportData.power_meter_recording.n_ampere} onChange={v => setReportData(p => ({ ...p, power_meter_recording: { ...p.power_meter_recording, n_ampere: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Voltage & Current Measurement ──────────────── */}
      <CollapsibleSection title="Voltage & Current Measurement" sectionKey="voltage" expanded={expandedSections.voltage} toggle={toggleSection} icon="🔌" badge={aiGenerated ? '✅ AI' : '—'}>
        <p className="text-[10px] text-slate-500 mb-3">Standard: +5% - 10% from 380V & 220V load deviation 10%</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MeasurementInput label="Voltage R-S" value={reportData.voltage_current.voltage_rs} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_rs: v } }))} />
          <MeasurementInput label="Voltage S-T" value={reportData.voltage_current.voltage_st} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_st: v } }))} />
          <MeasurementInput label="Voltage T-R" value={reportData.voltage_current.voltage_tr} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_tr: v } }))} />
          <MeasurementInput label="Voltage R-N" value={reportData.voltage_current.voltage_rn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_rn: v } }))} />
          <MeasurementInput label="Voltage S-N" value={reportData.voltage_current.voltage_sn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_sn: v } }))} />
          <MeasurementInput label="Voltage T-N" value={reportData.voltage_current.voltage_tn} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_tn: v } }))} />
          <MeasurementInput label="Voltage N-G" value={reportData.voltage_current.voltage_ng} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, voltage_ng: v } }))} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-700/30">
          <MeasurementInput label="Ampere R" value={reportData.voltage_current.ampere_r} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_r: v } }))} />
          <MeasurementInput label="Ampere S" value={reportData.voltage_current.ampere_s} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_s: v } }))} />
          <MeasurementInput label="Ampere T" value={reportData.voltage_current.ampere_t} onChange={v => setReportData(p => ({ ...p, voltage_current: { ...p.voltage_current, ampere_t: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Thermal Measurement ────────────────────────── */}
      <CollapsibleSection title="Thermal Measurement" sectionKey="thermal" expanded={expandedSections.thermal} toggle={toggleSection} icon="🌡️" badge={aiGenerated ? '✅ AI' : '—'}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MeasurementInput label="Result Temperature (°C)" value={reportData.thermal_measurement.result_temperature} onChange={v => setReportData(p => ({ ...p, thermal_measurement: { ...p.thermal_measurement, result_temperature: v } }))} />
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-500 font-bold">Standard</label>
            <div className="px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded text-xs text-yellow-400 font-mono">40°C</div>
          </div>
          <MeasurementInput label="Remarks" value={reportData.thermal_measurement.remarks} onChange={v => setReportData(p => ({ ...p, thermal_measurement: { ...p.thermal_measurement, remarks: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Grounding Resistance ────────────────────────── */}
      <CollapsibleSection title="Grounding Resistance Measurement" sectionKey="grounding" expanded={expandedSections.grounding} toggle={toggleSection} icon="⏚" badge={aiGenerated ? '✅ AI' : '—'}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MeasurementInput label="Result (Ω)" value={reportData.grounding_resistance.result_ohm} onChange={v => setReportData(p => ({ ...p, grounding_resistance: { ...p.grounding_resistance, result_ohm: v } }))} />
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-500 font-bold">Standard</label>
            <div className="px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded text-xs text-yellow-400 font-mono">{'<5 Ω'}</div>
          </div>
          <MeasurementInput label="Remarks" value={reportData.grounding_resistance.remarks} onChange={v => setReportData(p => ({ ...p, grounding_resistance: { ...p.grounding_resistance, remarks: v } }))} />
        </div>
      </CollapsibleSection>

      {/* ─── Section: Operation Status ────────────────────────────── */}
      <CollapsibleSection title="Operation Status" sectionKey="operation" expanded={expandedSections.operation} toggle={toggleSection} icon="⚙️" badge={aiGenerated ? '✅ AI' : '—'}>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={reportData.operation_status.is_normal} onChange={() => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, is_normal: true } }))} className="accent-green-500" />
              <span className="text-sm text-green-400 font-bold">Normal Operation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!reportData.operation_status.is_normal} onChange={() => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, is_normal: false } }))} className="accent-red-500" />
              <span className="text-sm text-red-400 font-bold">Abnormal Operation</span>
            </label>
          </div>
          {reportData.operation_status.is_normal ? (
            <MeasurementInput label="Remark" value={reportData.operation_status.remark} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, remark: v } }))} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MeasurementInput label="Fault Symptom" value={reportData.operation_status.fault_symptom} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_symptom: v } }))} />
              <MeasurementInput label="Fault Analysis" value={reportData.operation_status.fault_analysis} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_analysis: v } }))} />
              <MeasurementInput label="Work Done / Action Taken" value={reportData.operation_status.work_done} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, work_done: v } }))} />
              <MeasurementInput label="Fault Part SN" value={reportData.operation_status.fault_part_sn} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_part_sn: v } }))} />
              <MeasurementInput label="Fault Part Name" value={reportData.operation_status.fault_part_name} onChange={v => setReportData(p => ({ ...p, operation_status: { ...p.operation_status, fault_part_name: v } }))} />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ─── Section: Time Spent ──────────────────────────────────── */}
      <CollapsibleSection title="Time Spent" sectionKey="time" expanded={expandedSections.time} toggle={toggleSection} icon="⏱️">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="Date" value={timeSpent.date} onChange={v => setTimeSpent(p => ({ ...p, date: v }))} type="date" />
          <InputField label="Departure" value={timeSpent.departure} onChange={v => setTimeSpent(p => ({ ...p, departure: v }))} type="time" />
          <InputField label="Start" value={timeSpent.start} onChange={v => setTimeSpent(p => ({ ...p, start: v }))} type="time" />
          <InputField label="Finish" value={timeSpent.finish} onChange={v => setTimeSpent(p => ({ ...p, finish: v }))} type="time" />
        </div>
      </CollapsibleSection>

      {/* ─── Action Buttons ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleAIGenerate()}
          disabled={isAnalyzing}
          className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            isAnalyzing
              ? 'bg-slate-700 text-slate-400 cursor-wait border border-slate-600'
              : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Membuat Remark ({analysisProgress || 'AI sedang bekerja...'})</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Remark (AI)</span>
            </>
          )}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowPreview(true)}
          className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700 transition-all"
        >
          <Eye className="w-4 h-4" />
          Preview Service Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportPDF}
          className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </motion.button>
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
      className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => toggle(sectionKey)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-bold text-white">{title}</span>
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              badge.includes('AI') ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-400'
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
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">{children}</div>
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
      <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
      />
    </div>
  );
}

function MeasurementInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase text-slate-500 font-bold">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-amber-500/50 focus:outline-none"
        placeholder="—"
      />
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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 shadow-md cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={photo.label ? `Deskripsi: ${photo.label}` : 'Klik icon Edit di dalam untuk menambah deskripsi'}
    >
      <img src={photo.preview} alt={photo.label} className="w-full h-full object-cover" />
      <div
        className={`absolute inset-0 bg-slate-950/80 flex items-center justify-center gap-1.5 transition-all duration-150 ${hovered ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="p-1 bg-white/10 hover:bg-white/25 rounded transition-colors text-white"
          title="Lihat foto"
          aria-label="Lihat foto"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEditLabel(); }}
          className="p-1 bg-amber-500/20 hover:bg-amber-500/40 rounded transition-colors text-amber-300"
          title="Edit deskripsi"
          aria-label="Edit deskripsi"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 bg-red-500/20 hover:bg-red-500/40 rounded transition-colors text-red-400"
          title="Hapus foto"
          aria-label="Hapus foto"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Utility ────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 0.75 quality (highly optimized for size vs detail)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        // Fallback to original if image load fails
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
