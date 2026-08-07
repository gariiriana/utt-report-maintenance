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
  Download,
  FileText,
  Scissors,
  Eye,
  X,
  Search,
  Zap,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { exportSLAReportToDocx } from '@/utils/docxReportExport';
import { sendFileNotification } from '@/utils/notificationService';
import { ImageEditor } from './ImageEditor';

export interface EquipmentSLAItem {
  id: string;
  device: string;
  category: 'Electrical' | 'HVAC' | 'Mechanical' | 'Safety' | 'Civil';
  defaultPriority: 'High' | 'Medium' | 'Low';
  categoryBadgeColor?: string;
  notes?: string;
}

export const EQUIPMENT_SLA_CATALOG: EquipmentSLAItem[] = [
  // ⚡ 1. Electrical & Power System
  { id: 'ups', device: 'UPS (Uninterruptible Power Supply)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'ats', device: 'ATS (Automatic Transfer Switch)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'trafo', device: 'Transformer (Trafo Daya)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'mv_rmu', device: 'MV and RMU Panel (Medium Voltage)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'lv_panel', device: 'LV Panel (Low Voltage)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'pdu_panel', device: 'PDU Panel (Power Distribution Unit)', category: 'Electrical', defaultPriority: 'High' },

  { id: 'genset', device: 'Generator & Fuel System', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'ldb_rdb', device: 'Panel LDB & RDB (Distribution Board)', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'busduct', device: 'Busduct', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'cap_bank', device: 'Capacitor Bank', category: 'Electrical', defaultPriority: 'Medium' },

  { id: 'lighting', device: 'Lighting Point', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'grounding', device: 'Grounding System', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'lightning', device: 'Lightning Protection System (Penangkal Petir)', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'pju', device: 'PJU (Penerangan Jalan Umum)', category: 'Electrical', defaultPriority: 'Low' },

  // ❄️ 2. HVAC & Cooling System (All Medium)
  { id: 'crac', device: 'CRAC Data Hall & Supporting Room', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'chiller', device: 'Chiller', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_tower', device: 'Cooling Tower', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ct_water', device: 'Cooling Tower Water Treatment', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_pump', device: 'Cooling Pump', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'fcu', device: 'FCU (Fan Coil Unit)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ahu', device: 'AHU (Air Handling Unit)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'vrv', device: 'VRV System (Variable Refrigerant Volume)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ac_split', device: 'AC Splits', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'exhaust_fan', device: 'Exhaust Fan', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_automation', device: 'Physical Cooling Automation', category: 'HVAC', defaultPriority: 'Medium' },

  // 🛗 3. Mechanical & Utility System (All Low)
  { id: 'lift', device: 'Lift Units (Elevator Office & Campus)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'gate', device: 'Gate (Pagar / Autogate Utama)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'road_blocker', device: 'Road Blocker', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'dock_leveler', device: 'Dock Leveler', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'pumps', device: 'Pumps (Pompa Transfer / Umum)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'water_softener', device: 'Water Softener', category: 'Mechanical', defaultPriority: 'Low' },

  // 🛡️ 4. Safety & Fire Protection System (All Low)
  { id: 'fss', device: 'FSS (Fire Suppression System)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'hydrant', device: 'Hydrant System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'pre_action', device: 'Pre-Action System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'water_leak', device: 'Water Leak Detection System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'fuel_leak', device: 'Fuel Leak Detection System (Ground Tank)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'x_ray', device: 'X-Ray Scanner (Post Security Bravo)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'pressurization', device: 'Pressurization & Degassing', category: 'Safety', defaultPriority: 'Low' },

  // 🏢 5. Civil & Building Infrastructure (All Low)
  { id: 'stp_plumbing', device: 'STP & Plumbing (Sewage Treatment Plant)', category: 'Civil', defaultPriority: 'Low' },
  { id: 'door', device: 'Door (Pintu Akses Data Hall / Campus)', category: 'Civil', defaultPriority: 'Low' },
];

/** A single photo evidence item with optional description */
interface PhotoItem {
  photo: string;
  description: string;
}

interface SLAFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editId?: string;
}

export function SLAForm({ onSuccess, onCancel, editId }: SLAFormProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingPhotoInfo, setEditingPhotoInfo] = useState<{ field: 'photosResponse' | 'photosOnsite' | 'photosRestore' | 'photosResolution'; index: number } | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Maximum photos allowed per step
  const MAX_PHOTOS_PER_STEP = 10;

  // Equipment Search & SLA Prioritization States
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [isEquipmentDropdownOpen, setIsEquipmentDropdownOpen] = useState(false);
  const [selectedEquipmentItem, setSelectedEquipmentItem] = useState<EquipmentSLAItem | null>(null);
  const [isTotalBlackout, setIsTotalBlackout] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideCategoryFilter, setGuideCategoryFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');

  // Form State
  const [formData, setFormData] = useState({
    ticketName: '',
    location: '',
    priority: 'Medium' as 'Critical' | 'High' | 'Medium' | 'Low',
    picDME: '',
    picTDE: '',
    remark: '',

    // Response Time (Step 1) - Target < 5 Menit
    timeOrder: '',
    actualTimeResponse: '',
    targetResponseMin: 5,
    photosResponse: [] as PhotoItem[],

    // Onsite Principle Support (Step 2) - Target 120 Menit (2 Jam)
    actualTimeOnsite: '',
    targetOnsiteMin: 120,
    photosOnsite: [] as PhotoItem[],

    // Restore Service Time (Step 3) - Target 120 Menit (2 Jam)
    startOrder: '',
    finishOrder: '',
    targetRestoreMin: 120,
    photosRestore: [] as PhotoItem[],

    // Resolution Time (Step 4) - Target Dynamic based on Priority (Critical 2h, High 4h, Medium 6h, Low 48h)
    targetResolutionMin: 360,
    photosResolution: [] as PhotoItem[],
    resolutionRemark: '',
  });

  // Helper: migrate legacy single photo string to PhotoItem array
  const migratePhotos = (data: any, arrayKey: string, legacyKey: string): PhotoItem[] => {
    if (Array.isArray(data[arrayKey]) && data[arrayKey].length > 0) return data[arrayKey];
    if (data[legacyKey]) return [{ photo: data[legacyKey], description: '' }];
    return [];
  };

  // Load draft or existing report if editing
  useEffect(() => {
    if (editId) {
      const fetchReport = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'corrective_reports', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Merge old engineer onsite photo into onsite photos if present
            const onsitePhotos = migratePhotos(data, 'photosOnsite', 'photoOnsite');
            if (data.photoEngineerOnsite && !onsitePhotos.some((p: PhotoItem) => p.photo === data.photoEngineerOnsite)) {
              onsitePhotos.unshift({ photo: data.photoEngineerOnsite, description: 'Bukti Engineer Onsite' });
            }
            setFormData({
              ticketName: data.ticketName || '',
              location: data.location || '',
              priority: data.priority || 'Medium',
              picDME: data.picDME || '',
              picTDE: data.picTDE || '',
              remark: data.remark || '',
              timeOrder: data.timeOrder || '',
              actualTimeResponse: data.actualTimeResponse || '',
              targetResponseMin: data.targetResponseMin || 5,
              photosResponse: migratePhotos(data, 'photosResponse', 'photoResponse'),
              actualTimeOnsite: data.actualTimeOnsite || '',
              targetOnsiteMin: data.targetOnsiteMin || 120,
              photosOnsite: onsitePhotos,
              startOrder: data.startOrder || '',
              finishOrder: data.finishOrder || '',
              targetRestoreMin: data.targetRestoreMin || 120,
              photosRestore: migratePhotos(data, 'photosRestore', 'photoRestore'),
              targetResolutionMin: data.targetResolutionMin || 360,
              photosResolution: migratePhotos(data, 'photosResolution', 'photoResolution'),
              resolutionRemark: data.resolutionRemark || '',
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
            // Validate draft has new photo format, otherwise reset photos
            const draft = parsed.formData;
            if (draft.photoResponse !== undefined || draft.photoEngineerOnsite !== undefined) {
              // Legacy draft detected â€” clear it and start fresh
              localStorage.removeItem('sla_form_draft');
            } else {
              setFormData(draft);
            }
          }
          if (parsed.currentStep && parsed.currentStep <= 4) {
            setCurrentStep(parsed.currentStep);
          }
        } catch (e) {
          console.error('Failed to parse SLA draft', e);
        }
      }
    }
  }, [editId]);

  // Update targetResolutionMin dynamically based on priority category
  useEffect(() => {
    let target = 360;
    if (formData.priority === 'Critical') target = 120;       // 2 Jam
    else if (formData.priority === 'High') target = 240;      // 4 Jam
    else if (formData.priority === 'Medium') target = 360;    // 6 Jam
    else if (formData.priority === 'Low') target = 2880;      // 48 Jam

    setFormData(prev => ({ ...prev, targetResolutionMin: target }));
  }, [formData.priority]);

  // Equipment SLA Selection Handler
  const handleSelectEquipment = (item: EquipmentSLAItem) => {
    setSelectedEquipmentItem(item);
    setEquipmentSearch(item.device);
    setIsEquipmentDropdownOpen(false);

    // Auto set ticket name if empty or default format
    setFormData(prev => ({
      ...prev,
      ticketName: prev.ticketName ? prev.ticketName : `WO-${item.device}`
    }));

    if (!isTotalBlackout) {
      setFormData(prev => ({ ...prev, priority: item.defaultPriority }));
      toast.success(`Equipment Terpilih: ${item.device}`, {
        description: `Prioritas SLA otomatis disetel ke ${item.defaultPriority}`
      });
    } else {
      toast.info(`Equipment Terpilih: ${item.device}`, {
        description: 'Prioritas tetap CRITICAL karena status "Semua Unit Mati Total" sedang aktif.'
      });
    }
  };

  // Total Blackout / Critical Override Handler
  const handleToggleTotalBlackout = (checked: boolean) => {
    setIsTotalBlackout(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, priority: 'Critical' }));
      toast.error('🔥 CRITICAL PRIORITY APPLIED', {
        description: 'Status Semua Unit Mati Total (Total Loss) diaktifkan! Target Resolution: 2 Jam.'
      });
    } else {
      const defaultPrio = selectedEquipmentItem ? selectedEquipmentItem.defaultPriority : 'Medium';
      setFormData(prev => ({ ...prev, priority: defaultPrio }));
      toast.info('Status Total Loss dinonaktifkan', {
        description: `Prioritas dikembalikan ke ${defaultPrio}.`
      });
    }
  };

  // Filtered Equipment Catalog based on search
  const filteredEquipmentCatalog = EQUIPMENT_SLA_CATALOG.filter(item =>
    item.device.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

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

  // Derived Calculations & SLG Performance Weightings
  const [calcs, setCalcs] = useState({
    responseTimeMin: 0,
    responseComply: true,
    slgScoreRT: 5.0, // Bobot 5%
    onsiteTimeMin: 0,
    onsiteComply: true,
    slgScoreOTP: 5.0, // Bobot 5%
    restoreTimeMin: 0,
    restoreComply: true,
    slgScoreRST: 15.0, // Bobot 15%
    resolutionTimeMin: 0,
    resolutionComply: true,
    slgScoreRSP: 10.0, // Bobot 10%
    totalIncidentSlgScore: 35.0, // Total Bobot Insiden SLA (5 + 5 + 15 + 10 = 35%)
  });

  // Calculate SLA values & SLG Scores automatically on form changes
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

    // SLG Formula: (Target / Actual) * 100 * Bobot%, capped at 100% * Bobot%
    const scoreRT = responseTime > 0
      ? Math.min(100, (formData.targetResponseMin / responseTime) * 100) * 0.05
      : 5.0;

    const scoreOTP = onsiteTime > 0
      ? Math.min(100, (formData.targetOnsiteMin / onsiteTime) * 100) * 0.05
      : 5.0;

    const scoreRST = restoreTime > 0
      ? Math.min(100, (formData.targetRestoreMin / restoreTime) * 100) * 0.15
      : 15.0;

    const scoreRSP = resolutionTime > 0
      ? Math.min(100, (formData.targetResolutionMin / resolutionTime) * 100) * 0.10
      : 10.0;

    const totalSlg = scoreRT + scoreOTP + scoreRST + scoreRSP;

    setCalcs({
      responseTimeMin: responseTime,
      responseComply: formData.timeOrder && formData.actualTimeResponse ? responseTime <= formData.targetResponseMin : true,
      slgScoreRT: Number(scoreRT.toFixed(2)),
      onsiteTimeMin: onsiteTime,
      onsiteComply: formData.timeOrder && formData.actualTimeOnsite ? onsiteTime <= formData.targetOnsiteMin : true,
      slgScoreOTP: Number(scoreOTP.toFixed(2)),
      restoreTimeMin: restoreTime,
      restoreComply: (formData.startOrder || formData.timeOrder) && formData.finishOrder ? restoreTime <= formData.targetRestoreMin : true,
      slgScoreRST: Number(scoreRST.toFixed(2)),
      resolutionTimeMin: resolutionTime,
      resolutionComply: (formData.startOrder || formData.timeOrder) && formData.finishOrder ? resolutionTime <= formData.targetResolutionMin : true,
      slgScoreRSP: Number(scoreRSP.toFixed(2)),
      totalIncidentSlgScore: Number(totalSlg.toFixed(2)),
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

  // Sync Start Order with Onsite Principle time (non-editable)
  useEffect(() => {
    if (formData.actualTimeOnsite) {
      setFormData(prev => ({ ...prev, startOrder: formData.actualTimeOnsite }));
    }
  }, [formData.actualTimeOnsite]);

  // Multi-photo upload handler â€” compresses and appends to the specified photo array
  type PhotoField = 'photosResponse' | 'photosOnsite' | 'photosRestore' | 'photosResolution';

  const handleMultiPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: PhotoField) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPhotos = formData[field];
    if (currentPhotos.length >= MAX_PHOTOS_PER_STEP) {
      toast.error(`Maksimal ${MAX_PHOTOS_PER_STEP} foto per langkah`);
      return;
    }

    const remaining = MAX_PHOTOS_PER_STEP - currentPhotos.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    filesToProcess.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File "${file.name}" melebihi batas 15MB, dilewati.`);
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
          setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], { photo: compressedBase64, description: '' }]
          }));
          toast.success('Foto berhasil ditambahkan!');
        };
      };
    });

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Update description for a specific photo in a photo array
  const updatePhotoDescription = (field: PhotoField, index: number, description: string) => {
    setFormData(prev => {
      const updated = [...prev[field]];
      updated[index] = { ...updated[index], description };
      return { ...prev, [field]: updated };
    });
  };

  // Remove a specific photo from a photo array
  const removePhoto = (field: PhotoField, index: number) => {
    setFormData(prev => {
      const updated = prev[field].filter((_: PhotoItem, i: number) => i !== index);
      return { ...prev, [field]: updated };
    });
  };

  const validateStep = (targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;

    // Step 1 Validation: Response Time
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
      if (formData.photosResponse.length === 0) {
        toast.error('Mohon unggah minimal 1 Bukti Foto Response Time di Step 1');
        setCurrentStep(1);
        return false;
      }
    }

    // Step 2 Validation: Onsite Principle
    if (targetStep > 2) {
      if (!formData.actualTimeOnsite) {
        toast.error('Mohon isi Waktu Aktual Principle Onsite di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (formData.photosOnsite.length === 0) {
        toast.error('Mohon unggah minimal 1 Bukti Foto Onsite Principle di Step 2');
        setCurrentStep(2);
        return false;
      }
    }

    // Step 3 Validation: Restore Time
    if (targetStep > 3) {
      if (!formData.finishOrder) {
        toast.error('Mohon isi Waktu Layanan Pulih (Finish Order) di Step 3');
        setCurrentStep(3);
        return false;
      }
      if (formData.photosRestore.length === 0) {
        toast.error('Mohon unggah minimal 1 Bukti Foto Restore Service Time di Step 3');
        setCurrentStep(3);
        return false;
      }
    }

    // Step 4 Validation: Resolution
    if (targetStep > 4) {
      if (formData.photosResolution.length === 0) {
        toast.error('Mohon unggah minimal 1 Bukti Foto Resolution Time di Step 4');
        setCurrentStep(4);
        return false;
      }
      if (!formData.resolutionRemark?.trim()) {
        toast.error('Mohon isi Catatan Remark Resolution di Step 4');
        setCurrentStep(4);
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
    if (!validateStep(4)) return;
    if (!user) return;

    const isLocalhost = import.meta.env.DEV || (
      typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.endsWith('.local')
      )
    );

    if (!isLocalhost && formData.photosResolution.length === 0) {
      toast.error('Mohon unggah Bukti Foto Resolution Time pada Step 4');
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
        actionTaken: formData.resolutionRemark.trim() || formData.remark.trim() || 'Pemeliharaan corrective diselesaikan sesuai target SLA.',
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
        photosResponse: formData.photosResponse,
        // Legacy backward compat: keep first photo as string
        photoResponse: formData.photosResponse[0]?.photo || '',

        // SLA 2: Onsite Principle
        actualTimeOnsite: formData.actualTimeOnsite,
        actualOnsiteTimeMin: calcs.onsiteTimeMin,
        targetOnsiteMin: formData.targetOnsiteMin,
        onsiteComply: calcs.onsiteComply,
        photosOnsite: formData.photosOnsite,
        photoOnsite: formData.photosOnsite[0]?.photo || '',

        // SLA 3: Restore RST
        startOrder: formData.startOrder,
        finishOrder: formData.finishOrder,
        actualRestoreTimeMin: calcs.restoreTimeMin,
        targetRestoreMin: formData.targetRestoreMin,
        restoreComply: calcs.restoreComply,
        photosRestore: formData.photosRestore,
        photoRestore: formData.photosRestore[0]?.photo || '',

        // SLA 4: Resolution
        actualResolutionTimeMin: calcs.resolutionTimeMin,
        targetResolutionMin: formData.targetResolutionMin,
        resolutionComply: calcs.resolutionComply,
        photosResolution: formData.photosResolution,
        photoResolution: formData.photosResolution[0]?.photo || '',
        resolutionRemark: formData.resolutionRemark.trim(),

        // SLG Calculated Performance Scores & Weightings
        slgScoreRT: calcs.slgScoreRT,
        slgScoreOTP: calcs.slgScoreOTP,
        slgScoreRST: calcs.slgScoreRST,
        slgScoreRSP: calcs.slgScoreRSP,
        totalIncidentSlgScore: calcs.totalIncidentSlgScore,

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
    { title: 'Response Time', desc: 'SLA Respon (<5 M)' },
    { title: 'Onsite Principle', desc: 'SLA Onsite (2 H)' },
    { title: 'Restore Time', desc: 'SLA Restore (2 H)' },
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
            <span className="text-[10px] text-red-600 uppercase font-extrabold tracking-wider block">Langkah {currentStep} dari 4</span>
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
                <p className="text-slate-500 text-xs">Masukkan informasi order tiket, lokasi, prioritas, dan data Response Time (Target default &lt; 5 Menit).</p>
              </div>

              {/* Searchable Equipment Selector & SLA Guidance */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Pilih Equipment / Perangkat Terganggu
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">Ketik nama equipment untuk auto-suggest prioritas SLA secara presisi.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer self-start sm:self-auto"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Panduan SLA Equipment
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Searchable Equipment Combobox */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cari Equipment (Autocomplete)</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={equipmentSearch}
                        onChange={(e) => {
                          setEquipmentSearch(e.target.value);
                          setIsEquipmentDropdownOpen(true);
                        }}
                        onFocus={() => setIsEquipmentDropdownOpen(true)}
                        placeholder="Ketik misal: UPS, Chiller, Trafo, Generator..."
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm font-medium"
                      />
                      {equipmentSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setEquipmentSearch('');
                            setSelectedEquipmentItem(null);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Options */}
                    <AnimatePresence>
                      {isEquipmentDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setIsEquipmentDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100"
                          >
                            {filteredEquipmentCatalog.length > 0 ? (
                              filteredEquipmentCatalog.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectEquipment(item)}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between gap-2 group cursor-pointer"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition">
                                      {item.device}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Kategori: {item.category}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    item.defaultPriority === 'High'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : item.defaultPriority === 'Medium'
                                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}>
                                    {item.defaultPriority} SLA
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-500 font-medium">
                                Equipment "{equipmentSearch}" tidak ditemukan di katalog.
                              </div>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Equipment SLA Status Banner */}
                  <div className="flex items-center">
                    {selectedEquipmentItem ? (
                      <div className="w-full p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Equipment Terpilih</span>
                          <span className="text-xs font-bold text-slate-900">{selectedEquipmentItem.device}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Default Prioritas</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${
                            selectedEquipmentItem.defaultPriority === 'High'
                              ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                              : selectedEquipmentItem.defaultPriority === 'Medium'
                              ? 'bg-blue-500/10 text-blue-700 border-blue-500/30'
                              : 'bg-slate-500/10 text-slate-700 border-slate-500/30'
                          }`}>
                            {selectedEquipmentItem.defaultPriority} (Target {selectedEquipmentItem.defaultPriority === 'High' ? '4 Jam' : selectedEquipmentItem.defaultPriority === 'Medium' ? '6 Jam' : '48 Jam'})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full p-3 bg-slate-100 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
                        Ketik & pilih nama equipment di samping untuk rekomendasi SLA otomatis.
                      </div>
                    )}
                  </div>
                </div>

                {/* CRITICAL Condition Checkbox Switch Banner */}
                <div className={`p-3.5 rounded-xl border transition ${
                  isTotalBlackout
                    ? 'bg-red-500/10 border-red-500/40 text-red-900 shadow-md'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTotalBlackout}
                      onChange={(e) => handleToggleTotalBlackout(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 accent-red-600 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-red-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
                        🔥 Syarat CRITICAL: Seluruh Unit Mati Total / Tidak Ada Sumber Inflow (Total Loss)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Centang opsi ini jika <strong>seluruh unit di salah satu equipment mati total</strong> tanpa ada pasokan/inflow daya atau cooling. Otomatis menetapkan prioritas ke <strong>CRITICAL (Target 2 Jam / 120m)</strong>.
                      </p>
                    </div>
                  </label>
                </div>
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
                  <label className="block text-sm text-slate-400 font-medium mb-1.5">Prioritas Gangguan (Determines Resolution Target)</label>
                  <div className="relative group">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition" />
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      title="Prioritas Gangguan"
                      aria-label="Prioritas Gangguan"
                      className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm font-semibold ${
                        formData.priority === 'Critical'
                          ? 'border-red-500 text-red-600 bg-red-50/50'
                          : 'border-slate-200'
                      }`}
                    >
                      <option value="Critical">Critical (Target 2 Jam / 120m)</option>
                      <option value="High">High (Target 4 Jam / 240m)</option>
                      <option value="Medium">Medium (Target 6 Jam / 360m)</option>
                      <option value="Low">Low (Target 48 Jam / 2880m)</option>
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
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target Komitmen (Menit - Standar Kontrak)</label>
                  <input
                    disabled
                    type="number"
                    value={formData.targetResponseMin}
                    title="Target Response Time (Standar Kontrak < 5 Menit)"
                    placeholder="5"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold cursor-not-allowed shadow-inner"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Standar Komitmen Resmi: &lt; 5 Menit</span>
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

              {/* Multi-Photo Evidence Gallery */}
              <div>
                <label className="block text-sm text-slate-400 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Response Time *</label>
                {/* Existing Photos Grid */}
                {formData.photosResponse.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {formData.photosResponse.map((item, idx) => (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 group">
                        <div className="relative group overflow-hidden rounded-lg">
                          <img src={item.photo} alt={`Bukti Response ${idx + 1}`} className="w-full h-36 object-contain rounded-lg border border-slate-200 bg-white" />
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(item.photo)}
                              className="p-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Lihat Foto Fullscreen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhotoInfo({ field: 'photosResponse', index: idx })}
                              className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Crop / Edit Foto"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = item.photo;
                                link.download = `bukti_response_${idx + 1}.png`;
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
                              onClick={() => removePhoto('photosResponse', idx)}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updatePhotoDescription('photosResponse', idx, e.target.value)}
                          placeholder={`Deskripsi foto ${idx + 1}...`}
                          className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {/* Add Photo Button */}
                {formData.photosResponse.length < MAX_PHOTOS_PER_STEP && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                    <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500">
                      {formData.photosResponse.length === 0 ? 'Pilih berkas foto bukti' : '+ Tambah Foto Lagi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Gunakan screenshot WhatsApp, log tiket, atau email masuk (Max 15MB per foto, maks {MAX_PHOTOS_PER_STEP} foto)</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotoUpload(e, 'photosResponse')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Upload bukti respon"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STEP 2: ONSITE PRINCIPLE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                  <User className="w-5 h-5 text-red-600" />
                  Step 2: Onsite Principle SLA (OPE)
                </h3>
                <p className="text-slate-500 text-xs">Target kedatangan principle di lokasi (onsite) default adalah 120 Menit (2 Jam) dihitung sejak order dibuat.</p>
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
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Aktual Principle Onsite *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition" />
                    <input
                      required
                      type="datetime-local"
                      value={formData.actualTimeOnsite}
                      onChange={(e) => setFormData({ ...formData, actualTimeOnsite: e.target.value })}
                      title="Waktu Aktual Principle Onsite"
                      placeholder="Pilih waktu onsite"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target Komitmen (Menit - Standar Kontrak)</label>
                  <input
                    disabled
                    type="number"
                    value={formData.targetOnsiteMin}
                    title="Target Onsite Time (Standar Kontrak 120 Menit)"
                    placeholder="120"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold cursor-not-allowed shadow-inner"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Standar Komitmen Resmi: 120 Menit (2 Jam)</span>
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

              {/* Multi-Photo Evidence Gallery */}
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Foto Kedatangan Onsite Principle *</label>
                {formData.photosOnsite.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {formData.photosOnsite.map((item, idx) => (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 group">
                        <div className="relative group overflow-hidden rounded-lg">
                          <img src={item.photo} alt={`Bukti Onsite ${idx + 1}`} className="w-full h-36 object-contain rounded-lg border border-slate-200 bg-white" />
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(item.photo)}
                              className="p-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Lihat Foto Fullscreen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhotoInfo({ field: 'photosOnsite', index: idx })}
                              className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Crop / Edit Foto"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = item.photo;
                                link.download = `bukti_onsite_${idx + 1}.png`;
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
                              onClick={() => removePhoto('photosOnsite', idx)}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updatePhotoDescription('photosOnsite', idx, e.target.value)}
                          placeholder={`Deskripsi foto ${idx + 1}...`}
                          className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {formData.photosOnsite.length < MAX_PHOTOS_PER_STEP && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                    <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500">
                      {formData.photosOnsite.length === 0 ? 'Pilih berkas foto bukti onsite' : '+ Tambah Foto Lagi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Gunakan foto selfie di depan unit, screenshot share-loc WA, atau log kehadiran (Max 15MB)</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotoUpload(e, 'photosOnsite')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Upload bukti kedatangan"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STEP 3: RESTORE TIME â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                  <Activity className="w-5 h-5 text-red-600" />
                  Step 3: Restore Service Time SLA (RST)
                </h3>
                <p className="text-slate-500 text-xs">Target pemulihan layanan (temporary solution) default adalah 120 Menit (2 Jam) sejak principle onsite di lokasi.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">Waktu Mulai Pekerjaan (Start Order)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      disabled
                      type="datetime-local"
                      value={formData.startOrder}
                      title="Waktu Mulai Pekerjaan (otomatis dari waktu Principle Onsite)"
                      placeholder="Otomatis dari Principle Onsite"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block italic">Otomatis mengikuti waktu Principle Onsite</span>
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
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target Komitmen (Menit - Standar Kontrak)</label>
                  <input
                    disabled
                    type="number"
                    value={formData.targetRestoreMin}
                    title="Target Restore Time (Standar Kontrak 120 Menit)"
                    placeholder="120"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold cursor-not-allowed shadow-inner"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Standar Komitmen Resmi: 120 Menit (2 Jam)</span>
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

              {/* Multi-Photo Evidence Gallery */}
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Layanan Pulih *</label>
                {formData.photosRestore.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {formData.photosRestore.map((item, idx) => (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 group">
                        <div className="relative group overflow-hidden rounded-lg">
                          <img src={item.photo} alt={`Bukti Restore ${idx + 1}`} className="w-full h-36 object-contain rounded-lg border border-slate-200 bg-white" />
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(item.photo)}
                              className="p-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Lihat Foto Fullscreen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhotoInfo({ field: 'photosRestore', index: idx })}
                              className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Crop / Edit Foto"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = item.photo;
                                link.download = `bukti_restore_${idx + 1}.png`;
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
                              onClick={() => removePhoto('photosRestore', idx)}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updatePhotoDescription('photosRestore', idx, e.target.value)}
                          placeholder={`Deskripsi foto ${idx + 1}...`}
                          className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {formData.photosRestore.length < MAX_PHOTOS_PER_STEP && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                    <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500">
                      {formData.photosRestore.length === 0 ? 'Pilih berkas foto bukti' : '+ Tambah Foto Lagi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Gunakan screenshot grafik sistem normal, log tiket pulih, atau chat WA (Max 15MB)</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotoUpload(e, 'photosRestore')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Upload bukti layanan pulih"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STEP 4: RESOLUTION â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                  <CheckCircle2 className="w-5 h-5 text-red-600" />
                  Step 4: Resolution Time SLA &amp; Ringkasan Laporan
                </h3>
                <p className="text-slate-500 text-xs">Target resolusi permanen otomatis berdasarkan prioritas: Critical (2 Jam), High (4 Jam), Medium (6 Jam), Low (48 Jam).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1.5">SLA Target Resolusi (Menit - Otomatis Prioritas {formData.priority})</label>
                  <input
                    disabled
                    type="number"
                    value={formData.targetResolutionMin}
                    title="Target Resolution Time (Standar Kontrak Sesuai Prioritas)"
                    placeholder="360"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold cursor-not-allowed shadow-inner"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Target Otomatis Sesuai Prioritas: {formData.priority}</span>
                </div>
              </div>

              {/* Resolution Remark */}
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-1.5 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  Catatan Remark (Problem Solving &amp; Final Kondisi) *
                </label>
                <textarea
                  required
                  value={formData.resolutionRemark}
                  onChange={(e) => setFormData({ ...formData, resolutionRemark: e.target.value })}
                  placeholder="Jelaskan langkah-langkah problem solving yang dilakukan selama penanganan gangguan dan kondisi akhir setelah penyelesaian..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm resize-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Contoh: Melakukan restart unit, cek parameter, penggantian part XYZ. Kondisi akhir: sistem normal kembali.</span>
              </div>

              {/* Multi-Photo Evidence Gallery */}
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Bukti Tangkapan Layar (Screenshot) Tiket Closed/Selesai *</label>
                {formData.photosResolution.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {formData.photosResolution.map((item, idx) => (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 group">
                        <div className="relative group overflow-hidden rounded-lg">
                          <img src={item.photo} alt={`Bukti Resolusi ${idx + 1}`} className="w-full h-36 object-contain rounded-lg border border-slate-200 bg-white" />
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(item.photo)}
                              className="p-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Lihat Foto Fullscreen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhotoInfo({ field: 'photosResolution', index: idx })}
                              className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Crop / Edit Foto"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = item.photo;
                                link.download = `bukti_resolusi_${idx + 1}.png`;
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
                              onClick={() => removePhoto('photosResolution', idx)}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition shadow-md cursor-pointer backdrop-blur-xs"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updatePhotoDescription('photosResolution', idx, e.target.value)}
                          placeholder={`Deskripsi foto ${idx + 1}...`}
                          className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {formData.photosResolution.length < MAX_PHOTOS_PER_STEP && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-red-500 hover:bg-slate-50 transition cursor-pointer relative group">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-500">
                      {formData.photosResolution.length === 0 ? 'Pilih berkas foto bukti tiket closed' : '+ Tambah Foto Lagi'}
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotoUpload(e, 'photosResolution')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Upload bukti penyelesaian"
                    />
                  </div>
                )}
              </div>

              {/* Comprehensive SLA & SLG Review Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Ringkasan Pencapaian SLA &amp; Skor SLG (Insiden)</h4>
                  <div className="text-xs font-extrabold px-3 py-1 bg-red-500/10 text-red-600 border border-red-500/30 rounded-full">
                    Total Skor Insiden: {calcs.totalIncidentSlgScore}% / 35%
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">1. Response Time (RT 5%)</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.responseTimeMin} Menit</span>
                    <span className="text-[11px] font-bold text-blue-600 block mt-0.5">Skor SLG: {calcs.slgScoreRT}%</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 border ${
                      calcs.responseComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.responseComply ? 'COMPLY' : 'NOT COMPLY'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">2. Onsite Principle (OTP 5%)</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.onsiteTimeMin} Menit</span>
                    <span className="text-[11px] font-bold text-blue-600 block mt-0.5">Skor SLG: {calcs.slgScoreOTP}%</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 border ${
                      calcs.onsiteComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.onsiteComply ? 'COMPLY' : 'NOT COMPLY'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">3. Restore Time (RST 15%)</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.restoreTimeMin} Menit</span>
                    <span className="text-[11px] font-bold text-blue-600 block mt-0.5">Skor SLG: {calcs.slgScoreRST}%</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 border ${
                      calcs.restoreComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.restoreComply ? 'COMPLY' : 'NOT COMPLY'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">4. Resolution (RSP 10%)</span>
                    <span className="text-base font-extrabold text-slate-900 block mt-1">{calcs.resolutionTimeMin} Menit</span>
                    <span className="text-[11px] font-bold text-blue-600 block mt-0.5">Skor SLG: {calcs.slgScoreRSP}%</span>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 border ${
                      calcs.resolutionComply 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {calcs.resolutionComply ? 'COMPLY' : 'NOT COMPLY'}
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

          {currentStep < 4 ? (
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

      {editingPhotoInfo && (
        <ImageEditor
          image={formData[editingPhotoInfo.field][editingPhotoInfo.index].photo}
          onSave={(editedPhoto) => {
            const updated = [...formData[editingPhotoInfo.field]];
            updated[editingPhotoInfo.index] = { ...updated[editingPhotoInfo.index], photo: editedPhoto };
            setFormData({ ...formData, [editingPhotoInfo.field]: updated });
            setEditingPhotoInfo(null);
          }}
          onCancel={() => setEditingPhotoInfo(null)}
        />
      )}

      {/* Panduan SLA Equipment Reference Modal */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-600" />
                    Panduan Matriks Prioritas SLA & SLG Equipment
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Panduan resmi penetapan level gangguan untuk Standby Engineer di Neutra DC Cikarang.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Filter Tabs */}
              <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-500 mr-2">Filter Level:</span>
                {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setGuideCategoryFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      guideCategoryFilter === filter
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter === 'All' ? 'Semua Equipment (34)' : filter}
                  </button>
                ))}
              </div>

              {/* CRITICAL Condition Rule Alert */}
              <div className="px-6 pt-4">
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900 text-xs">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-red-700 block">🔴 Syarat Khusus Level CRITICAL (Target Resolution: 2 Jam / 120m):</span>
                    <p className="text-red-800 leading-relaxed mt-0.5">
                      Level <strong>CRITICAL</strong> berlaku untuk <strong>SEMUA equipment</strong> apabila terjadi kondisi <strong>seluruh unit mati total / tidak ada sumber inflow</strong> yang masuk (contoh: Total Blackout, Total Cooling Stop, atau redundansi N+1 runtuh total).
                    </p>
                  </div>
                </div>
              </div>

              {/* Equipment Grid List */}
              <div className="p-6 overflow-y-auto max-h-[55vh] space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {EQUIPMENT_SLA_CATALOG.filter(item => {
                    if (guideCategoryFilter === 'All') return true;
                    if (guideCategoryFilter === 'Critical') return false; // Critical is condition-based
                    return item.defaultPriority === guideCategoryFilter;
                  }).map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.device}</div>
                        <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                          Kategori: {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${
                          item.defaultPriority === 'High'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : item.defaultPriority === 'Medium'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}>
                          {item.defaultPriority} ({item.defaultPriority === 'High' ? '4 Jam' : item.defaultPriority === 'Medium' ? '6 Jam' : '48 Jam'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectEquipment(item);
                            setShowGuideModal(false);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md transition cursor-pointer"
                        >
                          Pilih
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Tutup Panduan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

