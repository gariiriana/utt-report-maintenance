import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Upload, Camera, FileType, Scissors, RefreshCw, Save, ChevronLeft, ChevronRight, X, Eye, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ExcelDocument } from '@/components/DocumentList';
import { ImageEditor } from '@/components/ImageEditor';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebase';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';

import {
  REPORT_TEMPLATES,
  VRV_TEMPLATE,
  LV_ATS_TRAFO_TEMPLATE
} from '@/config/templates';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import { compressImage, compressBase64Image } from '@/utils/imageCompression';
import { PreviewReport } from '@/components/PreviewReport';
import { CameraModal } from '@/components/CameraModal';
import { draftStorage } from '@/utils/draftStorage';

import imgStatusWld from '@/assets/Wld/status.jpeg';
import imgTestPingWld from '@/assets/Wld/test_ping.jpeg';
import imgSystemSettingWld from '@/assets/Wld/system_setting.jpeg';
import imgVoltageMeasurementWld from '@/assets/Wld/voltage_measurement.jpeg';
import imgCommunicationSettingWld from '@/assets/Wld/communication_setting.jpeg';
import imgCurrentMeasurementWld from '@/assets/Wld/current_measurement.jpeg';
import imgFgBbox2CablesFld from '@/assets/Fld/fg_bbox_2_cables.jpeg';
import imgTesPingFld from '@/assets/Fld/tes_ping_fld.jpeg';

const WLD_DEFAULT_PHOTOS: Record<string, string> = {
  'Status': imgStatusWld,
  'Test Ping': imgTestPingWld,
  'System Setting': imgSystemSettingWld,
  'Voltage Measurement': imgVoltageMeasurementWld,
  'Communication Setting': imgCommunicationSettingWld,
  'FG BBOX #2 CABLES': imgFgBbox2CablesFld,
  'Current Measurement': imgCurrentMeasurementWld,
};

export interface PhotoCard {
  id: string;
  photo: File | null;
  photoBase64?: string;
  description: string;
}

export interface ReportUnit {
  id: string;
  tabName: string; // Excel Tab Marker (e.g., Sub A)
  specificDetail: string; // Detail Unit Maintenance (e.g., FCU-01)
  vrvUnitDetail: string;
  cards: PhotoCard[];
}

interface ReportFormProps {
  editingData?: ExcelDocument | null;
  onClearEdit?: () => void;
}

export function ReportForm({ editingData, onClearEdit }: ReportFormProps) {
  const { user, userRole, companyType: authCompanyType } = useAuth();
  const [companyType, setCompanyType] = useState<'neutra' | 'bri'>('neutra');
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');
  
  // NEW: Multi-Unit State
  const [units, setUnits] = useState<ReportUnit[]>([]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = 200;
      tabContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [numberOfCardsToAdd, setNumberOfCardsToAdd] = useState<string>('1');
  const [showPreview, setShowPreview] = useState(false);
  const [activeCameraCardId, setActiveCameraCardId] = useState<string | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(true);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [cardClipboard, setCardClipboard] = useState<{ photoBase64?: string, description: string } | null>(null);

  // Helper to get active unit
  const activeUnit = units.find(u => u.id === activeUnitId) || null;
  const cards = activeUnit?.cards || [];
  const setCards = (newCards: PhotoCard[] | ((prev: PhotoCard[]) => PhotoCard[])) => {
    if (!activeUnitId) return;
    setUnits(prev => prev.map(u => {
      if (u.id === activeUnitId) {
        return {
          ...u,
          cards: typeof newCards === 'function' ? (newCards as any)(u.cards) : newCards
        };
      }
      return u;
    }));
  };

  const setTabName = (val: string) => {
    if (!activeUnitId) return;
    setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, tabName: val } : u));
  };
  const setSpecificDetail = (val: string) => {
    if (!activeUnitId) return;
    setUnits(prev => prev.map(u => {
      if (u.id === activeUnitId) {
        // Auto-sync tab name if it's currently default (e.g. "Unit 1")
        const isDefaultTab = !u.tabName || /^Unit \d+$/i.test(u.tabName);
        return { 
          ...u, 
          specificDetail: val,
          tabName: isDefaultTab ? (val || u.tabName) : u.tabName
        };
      }
      return u;
    }));
  };
  const setVrvUnitDetail = (val: string) => {
    if (!activeUnitId) return;
    setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, vrvUnitDetail: val } : u));
  };

  const tabName = activeUnit?.tabName || '';
  const specificDetail = activeUnit?.specificDetail || '';
  const vrvUnitDetail = activeUnit?.vrvUnitDetail || '';

  const createDefaultCards = (count: number = 11) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${i + 1}`,
      photo: null,
      description: ''
    }));
  };

  const addNewUnit = async (name: string = '') => {
    const newId = Math.random().toString(36).substr(2, 9);
    
    // Initial cards
    let initialCards = createDefaultCards(11);
    
    // Auto-apply template if possible
    if (user?.email) {
      const lowerEmail = user.email.toLowerCase();
      let template: string[] | null = null;
      
      if (lowerEmail === 'vrv@gmail.com') {
        template = VRV_TEMPLATE.indoor;
      } else if (['lv@gmail.com', 'ats@gmail.com', 'trafo@gmail.com'].includes(lowerEmail)) {
        template = LV_ATS_TRAFO_TEMPLATE(lowerEmail);
      } else {
        template = REPORT_TEMPLATES[lowerEmail];
        if (!template && (lowerEmail.includes('dock') || lowerEmail.includes('leveler'))) {
          template = REPORT_TEMPLATES['dock'];
        }
      }

      if (template) {
        if (lowerEmail === 'wld@gmail.com' || lowerEmail === 'fld@gmail.com') {
          initialCards = await Promise.all(template.map(async (desc, idx) => {
            let defaultUrl = WLD_DEFAULT_PHOTOS[desc];
            if (lowerEmail === 'fld@gmail.com' && desc === 'Test Ping') defaultUrl = imgTesPingFld;
            let b64 = defaultUrl ? await loadLogoBase64(defaultUrl) : undefined;
            return { id: `${idx + 1}`, photo: null, photoBase64: b64, description: desc };
          }));
        } else {
          initialCards = template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc }));
        }
      }
    }

    const newUnit: ReportUnit = {
      id: newId,
      tabName: name || `Unit ${units.length + 1}`,
      specificDetail: '',
      vrvUnitDetail: '',
      cards: initialCards.length > 0 ? initialCards : createDefaultCards(11)
    };
    
    setUnits(prev => [...prev, newUnit]);
    setActiveUnitId(newId);
    return newId;
  };

  // Initialize first unit if empty
  useEffect(() => {
    if (isDraftLoading || editingData) return;
    if (units.length === 0) {
      addNewUnit();
    }
  }, [isDraftLoading, units.length, editingData]);

  useEffect(() => {
    if (authCompanyType) {
      setCompanyType(authCompanyType);
    }
  }, [authCompanyType]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [showPreview]);

  // Load Draft Logic
  useEffect(() => {
    if (!user?.email || editingData) {
      setIsDraftLoading(false);
      return;
    }

    const loadDraft = async () => {
      const finished = localStorage.getItem('report_finished');
      if (finished === 'true') {
        await draftStorage.remove('report_form_draft_v2');
        localStorage.removeItem('report_finished');
        setIsDraftLoading(false);
        return;
      }

      // 1. Try Loading from IndexedDB (New Storage)
      let saved = await draftStorage.get('report_form_draft_v2');
      
      // 2. Fallback to LocalStorage (Migration)
      if (!saved) {
        const legacySaved = localStorage.getItem('report_form_draft_v2');
        if (legacySaved) {
          try {
            saved = JSON.parse(legacySaved);
            // Move to IndexedDB and remove from localStorage
            await draftStorage.set('report_form_draft_v2', saved);
            localStorage.removeItem('report_form_draft_v2');
            console.log('Draft migrated from localStorage to IndexedDB');
          } catch (e) {
            console.error('Failed to parse legacy draft:', e);
          }
        }
      }

      if (saved) {
        try {
          const draft = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (draft.userEmail === user.email) {
            setMaintenanceName(draft.maintenanceName || '');
            setMaintenanceTime(draft.maintenanceTime || '');
            if (draft.companyType) setCompanyType(draft.companyType);
            if (draft.units && draft.units.length > 0) {
              const lowerEmail = user?.email?.toLowerCase() || '';
              let template: string[] | null = null;
              if (lowerEmail === 'vrv@gmail.com') {
                template = VRV_TEMPLATE.indoor; // Default to indoor for draft sync simplicity
              } else if (['lv@gmail.com', 'ats@gmail.com', 'trafo@gmail.com'].includes(lowerEmail)) {
                template = LV_ATS_TRAFO_TEMPLATE(lowerEmail);
              } else {
                template = REPORT_TEMPLATES[lowerEmail] || (lowerEmail.includes('dock') || lowerEmail.includes('leveler') ? REPORT_TEMPLATES['dock'] : null);
              }

              setUnits(draft.units.map((u: any) => {
                let unitCards = u.cards.map((c: any) => ({ ...c, photo: null }));
                if (template && unitCards.length < template.length) {
                  const missing = template.slice(unitCards.length);
                  const appended = missing.map((desc, i) => ({
                    id: `${unitCards.length + i + 1}`,
                    photo: null,
                    description: desc
                  }));
                  unitCards = [...unitCards, ...appended];
                }
                return { ...u, cards: unitCards };
              }));
              setActiveUnitId(draft.units[0].id);
            }
            toast.info('Draft dimuat dari penyimpanan aman (IndexedDB)', { duration: 2000 });
          }
        } catch (err) {
          console.error('Failed to process draft:', err);
        }
      }
      setIsDraftLoading(false);
    };

    loadDraft();
  }, [user?.email, editingData]);


  // Keyboard Shortcuts (Copy-Paste)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in a description textarea or input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      // Ctrl + C (Copy)
      if (e.ctrlKey && e.key === 'c') {
        if (!focusedCardId) return;
        const cardToCopy = cards.find(c => c.id === focusedCardId);
        if (cardToCopy) {
          setCardClipboard({
            photoBase64: cardToCopy.photoBase64,
            description: cardToCopy.description
          });
          toast.success('Kartu disalin ke clipboard', { 
            icon: '📋',
            duration: 1500 
          });
        }
      }

      // Ctrl + V (Paste)
      if (e.ctrlKey && e.key === 'v') {
        if (!focusedCardId || !cardClipboard) return;
        
        setCards(prev => prev.map(c => {
          if (c.id === focusedCardId) {
            return {
              ...c,
              photoBase64: cardClipboard.photoBase64,
              description: cardClipboard.description
            };
          }
          return c;
        }));
        
        toast.success('Konten kartu ditempel', { 
          icon: '📥',
          duration: 1500 
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCardId, cardClipboard, cards]);

  // Handle External Paste (Images)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Ignore if typing in a description textarea or input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items || !focusedCardId) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const toastId = toast.loading('Memproses gambar dari clipboard...');
            try {
              const base64 = await compressImage(file);
              setCards(prev => prev.map(c => c.id === focusedCardId ? { ...c, photo: file, photoBase64: base64 } : c));
              toast.success('Gambar berhasil ditempel!', { id: toastId });
            } catch (error) {
              console.error('Paste error:', error);
              toast.error('Gagal menempel gambar', { id: toastId });
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [focusedCardId]);

  useEffect(() => {
    if (editingData || user?.email?.toLowerCase() !== 'vrv@gmail.com' || isDraftLoading) return;

    // Only auto-apply template if current unit is empty or has default structure
    const hasExistingPhotos = cards.some(c => c.photoBase64);
    if (hasExistingPhotos) return;

    const isOutdoor = specificDetail.toLowerCase() === 'outdoor';
    const template = isOutdoor ? VRV_TEMPLATE.outdoor : VRV_TEMPLATE.indoor;

    if (template) {
      setCards(template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    }
  }, [specificDetail, user?.email, editingData, isDraftLoading]);

  useEffect(() => {
    if (editingData) {
      setMaintenanceName(editingData.maintenanceName);
      setMaintenanceTime(editingData.maintenanceTime);

      if (user?.email === 'vrv@gmail.com' && editingData.specificDetail?.includes(' - ')) {
        const [type, ...rest] = editingData.specificDetail.split(' - ');
        setSpecificDetail(type.toLowerCase());
        setVrvUnitDetail(rest.join(' - '));
      } else {
        setSpecificDetail(editingData.specificDetail || '');
        setVrvUnitDetail('');
      }
      if (editingData.photosData?.length > 0) {
        setCards(editingData.photosData.map((p: any) => ({
          id: `${p.index}`,
          photo: null,
          photoBase64: p.photoBase64 || null,
          description: p.description || ''
        })));
      }
    }
  }, [editingData]);

  useEffect(() => {
    if (editingData || !user?.email || isDraftLoading) return;

    const saveDraft = async () => {
      const draft = {
        userEmail: user.email,
        maintenanceName,
        maintenanceTime,
        companyType,
        units: units.map(u => ({
          ...u,
          cards: u.cards.map(c => ({
            id: c.id,
            description: c.description,
            photoBase64: c.photoBase64
          }))
        })),
        timestamp: new Date().getTime()
      };

      try {
        await draftStorage.set('report_form_draft_v2', draft);
      } catch (err) {
        console.error('Storage error:', err);
        // IndexedDB handles much larger data, so quota issues are rare
      }
    };

    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [maintenanceName, maintenanceTime, companyType, units, user?.email, editingData, isDraftLoading]);

  const handlePhotoChange = async (id: string, file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast.error('Ukuran foto maksimal 5MB');
      try {
        toast.loading('Processing...', { id: `compress-${id}` });
        const base64 = await compressImage(file);
        setCards(prev => prev.map(c => c.id === id ? { ...c, photo: file, photoBase64: base64 } : c));
        toast.success('Foto dimuat', { id: `compress-${id}` });
      } catch {
        toast.error('Gagal memuat foto', { id: `compress-${id}` });
      }
    } else {
      setCards(prev => prev.map(c => c.id === id ? { ...c, photo: null, photoBase64: undefined } : c));
    }
  };

  const handleCapture = async (id: string, base64: string) => {
    try {
      toast.loading('Compressing...', { id: `camera-${id}` });
      const compressed = await compressBase64Image(base64, { maxWidth: 800, quality: 0.5 });
      setCards(prev => prev.map(c => c.id === id ? { ...c, photo: null, photoBase64: compressed } : c));
      toast.success('Foto ditangkap', { id: `camera-${id}` });
    } catch {
      toast.error('Gagal memproses foto kamera', { id: `camera-${id}` });
    }
  };

  const handleBulkPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const toastId = toast.loading(`Processing ${files.length} photos...`);
    try {
      const currentCards = [...cards];
      let fileIndex = 0;
      for (let i = 0; i < currentCards.length && fileIndex < files.length; i++) {
        if (!currentCards[i].photo) {
          if (files[fileIndex].size <= 5 * 1024 * 1024) {
            currentCards[i] = { ...currentCards[i], photo: files[fileIndex], photoBase64: await compressImage(files[fileIndex]) };
            fileIndex++;
          } else {
            toast.error(`File ${files[fileIndex].name} too large`, { id: toastId });
            fileIndex++; i--;
          }
        }
      }
      while (fileIndex < files.length) {
        if (files[fileIndex].size <= 5 * 1024 * 1024) {
          const nextId = (Math.max(...currentCards.map(c => parseInt(c.id))) + 1).toString();
          currentCards.push({ id: nextId, photo: files[fileIndex], photoBase64: await compressImage(files[fileIndex]), description: '' });
        }
        fileIndex++;
      }
      setCards(currentCards);
      toast.success('Upload complete', { id: toastId });
    } catch {
      toast.error('Gagal process foto', { id: toastId });
    }
    e.target.value = '';
  };

  const handleApplyEdit = (id: string, editedBase64: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, photoBase64: editedBase64 } : c));
    setEditingCardId(null);
    toast.success('Photo updated');
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, description } : c));
  };

  const handleDownloadPhoto = (base64: string, description: string, index: number) => {
    const link = document.createElement('a');
    link.href = base64;
    const ts = new Date().getTime();
    const cleanMain = (maintenanceName || 'report').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanUnit = (specificDetail || 'unit').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanDesc = (description || `doc${index + 1}`).substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${cleanMain}_${cleanUnit}_${cleanDesc}_${ts}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Foto diunduh');
  };

  const confirmAddCards = () => {
    const count = parseInt(numberOfCardsToAdd);
    if (isNaN(count) || count < 1 || count > 50) return toast.error('1-50 cards');
    const startId = Math.max(...cards.map(c => parseInt(c.id))) + 1;
    const added = Array.from({ length: count }, (_, i) => ({ id: (startId + i).toString(), photo: null, description: '' }));
    setCards(prev => [...prev, ...added]);
    setAddCardModalOpen(false);
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) setCards(prev => prev.filter(c => c.id !== id));
    else toast.error('Minimal 1 card');
  };

  const generatePDFDocument = async (unit: ReportUnit) => {
    const logoLeftB64 = await loadLogoBase64(companyType === 'bri' ? logoBRILeft : logoDwimitra);
    const logoRightB64 = await loadLogoBase64(companyType === 'bri' ? logoBRI : logoNeutraDC);

    const finalSpecificDetail = (user?.email === 'vrv@gmail.com' && unit.vrvUnitDetail)
      ? `${unit.specificDetail.toUpperCase()} - ${unit.vrvUnitDetail.toUpperCase()}`
      : unit.specificDetail;

    return await generateReportPDF({
      maintenanceName,
      maintenanceTime,
      specificDetail: finalSpecificDetail,
      vrvUnitDetail: unit.vrvUnitDetail,
      cards: unit.cards,
      companyType,
      userEmail: user?.email || '',
      logos: {
        left: logoLeftB64,
        right: logoRightB64
      }
    });
  };

  const saveReportViaAPI = async (apiUrl: string, collectionName: string, reportData: any, photos: any[]) => {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Secret': import.meta.env.VITE_API_SECRET || '',
        },
        body: JSON.stringify({
          collection: collectionName,
          sub_data: photos,
          ...reportData,
          processedBy: 'golang_api',
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.reportId;
    } catch (error) {
      console.error('API Save Error:', error);
      return null;
    }
  };

  const saveReportToFirestore = async (unit: ReportUnit, pdfData?: { doc: jsPDF, fileName: string, filled: PhotoCard[] }) => {
    if (!maintenanceName || !maintenanceTime) return toast.error('Isi nama & waktu'), null;

    const finalSpecificDetail = (user?.email === 'vrv@gmail.com' && unit.vrvUnitDetail)
      ? `${unit.specificDetail.toUpperCase()} - ${unit.vrvUnitDetail.toUpperCase()}`
      : unit.specificDetail;

    const cardsToSave = pdfData ? pdfData.filled : unit.cards.filter(c => c.photoBase64 || c.description);
    if (!cardsToSave.length) return toast.error(`Unit ${unit.specificDetail || 'Untitled'} minimal 1 card filled`), null;

    const toastId = toast.loading(`Saving unit ${unit.specificDetail || '#'}...`);
    try {
      const photosWithImage = cardsToSave.filter(c => c.photoBase64).length;
      const fileName = pdfData?.fileName || `${maintenanceName}${finalSpecificDetail ? ` (${finalSpecificDetail})` : ''}`.trim().replace(/\s+/g, ' ') + '.pdf';

      const reportData: any = {
        fileName,
        maintenanceName,
        maintenanceTime,
        specificDetail: finalSpecificDetail,
        updatedAt: serverTimestamp(),
        totalPhotos: cardsToSave.length,
        photosWithImage,
        fileSize: pdfData?.doc ? pdfData.doc.output('arraybuffer').byteLength : 0,
      };

      if (!editingData) {
        reportData.createdBy = user?.email;
        reportData.createdAt = serverTimestamp();
      }

      const collectionName = editingData?.documentType === 'excel' ? 'excel_documents' : 'pdf_documents';
      const apiUrl = import.meta.env.VITE_API_URL;
      const isOnline = navigator.onLine;

      if (isOnline && apiUrl && !editingData) {
        const photos = cardsToSave.map((card, i) => ({
          index: i + 1,
          photoBase64: card.photoBase64 || '',
          description: card.description || '',
          hasPhoto: !!card.photoBase64
        }));

        const docIdFromAPI = await saveReportViaAPI(apiUrl, collectionName, reportData, photos);
        if (docIdFromAPI) {
          toast.success(`Unit ${unit.specificDetail} disimpan (via API)`, { id: toastId });
          return docIdFromAPI;
        }
      }

      let docId = '';
      if (editingData) {
        docId = editingData.id;
        await updateDoc(doc(db, collectionName, docId), reportData);
        const photosRef = collection(db, `${collectionName}/${docId}/photos`);
        const existingPhotos = await getDocs(photosRef);
        for (const photoDoc of existingPhotos.docs) {
          await deleteDoc(doc(db, `${collectionName}/${docId}/photos`, photoDoc.id));
        }
      } else {
        const docRef = await addDoc(collection(db, 'pdf_documents'), reportData);
        docId = docRef.id;
      }

      for (let i = 0; i < cardsToSave.length; i++) {
        const card = cardsToSave[i];
        if (card.photoBase64) {
          let b64 = card.photoBase64;
          const sizeInBytes = (b64.length * 3) / 4;
          if (sizeInBytes > 800 * 1024) {
            try {
              b64 = await compressBase64Image(b64, { maxWidth: 800, quality: 0.5 });
            } catch (err) { console.error("Compression failure", err); }
          }
          await addDoc(collection(db, `${editingData ? collectionName : 'pdf_documents'}/${docId}/photos`), {
            index: i + 1,
            photoBase64: b64,
            description: card.description || '',
            hasPhoto: true
          });
        }
      }

      toast.success(`Unit ${unit.specificDetail} berhasil disimpan`, { id: toastId });
      return docId;
    } catch (error) {
      console.error('Firestore save error:', error);
      toast.error('Gagal simpan', { id: toastId });
      return null;
    }
  };



  const handleExportPDF = async (unit?: ReportUnit) => {
    const targetUnit = unit || activeUnit;
    if (!targetUnit) return toast.error('Unit tidak terpilih');
    
    const result = await generatePDFDocument(targetUnit);
    if (result) {
      const { doc, fileName } = result;
      doc.save(fileName);
      await saveReportToFirestore(targetUnit, result);
      localStorage.setItem('report_finished', 'true');
    }
  };



  const handleManualSave = async () => {
    if (!activeUnit) return;
    await saveReportToFirestore(activeUnit);
  };

  const uploadedCount = cards.filter(c => c.photoBase64).length;


  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
      <AnimatePresence mode="wait">
        {!showPreview ? (
          <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 min-w-[120px]">
                  <p className="text-xs text-slate-500 uppercase font-bold">Foto</p>
                  <p className="text-xl font-bold text-white">{uploadedCount} / {cards.length}</p>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 min-w-[120px]">
                  <p className="text-xs text-slate-500 uppercase font-bold">Template</p>
                  <p className="text-xl font-bold text-blue-400 uppercase">{companyType}</p>
                </div>
              </div>
              {editingData && (
                <button onClick={onClearEdit} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 text-sm font-bold flex items-center gap-2 hover:bg-blue-600/30 transition-all">
                  <RefreshCw className="w-4 h-4" /> Batal Edit
                </button>
              )}
            </div>

            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 mb-6 font-geist">
              {/* Main Maintenance Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Nama Maintenance</label>
                  <input
                    type="text"
                    value={maintenanceName}
                    onChange={e => setMaintenanceName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="cth. Maintenance Bulanan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Detail Unit Maintenance</label>
                  <input
                    type="text"
                    value={specificDetail}
                    onChange={(e) => setSpecificDetail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-blue-400 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="cth. FCU-01 / VRV-02"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Waktu Maintenance</label>
                  <input type="date" value={maintenanceTime} onChange={(e) => setMaintenanceTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Situs / Proyek</label>
                  <select
                    value={companyType}
                    onChange={e => setCompanyType(e.target.value as 'neutra' | 'bri')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-10"
                  >
                    <option value="neutra">NeutraDC</option>
                    <option value="bri">Bank BRI</option>
                  </select>
                </div>
              </div>

              {/* Excel-style Sheet Tabs */}
              <div className="mt-8 select-none">
                <div className="flex items-center bg-slate-950/50 backdrop-blur-md border border-slate-800/50 rounded-t-xl overflow-hidden h-10 shadow-2xl">
                  <div className="flex items-center px-2 border-r border-slate-800/50 gap-1 shrink-0">
                    <button onClick={() => scrollTabs('left')} className="p-1.5 hover:bg-white/5 transition-colors rounded-lg text-slate-500 hover:text-blue-400"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => scrollTabs('right')} className="p-1.5 hover:bg-white/5 transition-colors rounded-lg text-slate-500 hover:text-blue-400"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  
                  <div ref={tabContainerRef} className="flex-1 flex items-end overflow-x-auto no-scrollbar h-full scroll-smooth">
                    {units.map((unit, idx) => (
                      <div
                        key={unit.id}
                        onClick={() => setActiveUnitId(unit.id)}
                        className={`group relative flex items-center min-w-[110px] sm:min-w-[140px] h-full px-3 sm:px-5 cursor-pointer transition-all duration-200 border-r border-slate-800/50 shrink-0 ${
                          activeUnitId === unit.id 
                            ? 'bg-slate-900/80 z-10 shadow-[inset_0_-2px_10px_rgba(0,0,0,0.5)]' 
                            : 'bg-transparent hover:bg-white/5'
                        }`}
                      >
                        {activeUnitId === unit.id ? (
                          <div className="flex items-center gap-2 sm:gap-3 w-full">
                             <input
                              autoFocus
                              value={tabName}
                              onChange={(e) => setTabName(e.target.value)}
                              className="bg-transparent border-none outline-none text-blue-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider w-full"
                              placeholder="NAMA UNIT..."
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (units.length > 1) {
                                  setUnits(prev => prev.filter(u => u.id !== unit.id));
                                  if (activeUnitId === unit.id) setActiveUnitId(units[idx === 0 ? 1 : idx - 1].id);
                                }
                              }}
                              className="p-1 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                            >
                              <X className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <span className="text-slate-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider truncate group-hover:text-slate-300">
                              {unit.tabName || `Unit ${idx + 1}`}
                            </span>
                          </div>
                        )}
                        
                        {activeUnitId === unit.id && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center px-1 border-l border-slate-800/50 shrink-0 bg-slate-900/40">
                    <button
                      onClick={() => addNewUnit(`Unit ${units.length + 1}`)}
                      className="p-2 hover:bg-blue-600/10 text-blue-500/60 hover:text-blue-400 flex items-center justify-center transition-all rounded-lg"
                      title="Tambah Unit Baru"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Secondary Shadow Bar / Connector to Content */}
                <div className="h-1 bg-slate-900/40 border-b border-slate-800/50 mb-10 shadow-sm" />
              </div>

            {/* Current Unit Detail Header */}
            {activeUnit && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 px-2 gap-4">
                <div className="flex-1">
                  <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight flex items-wrap items-center gap-2 sm:gap-3">
                    <span className="px-1.5 py-0.5 bg-blue-600 text-[9px] rounded flex items-center justify-center font-mono">#{units.findIndex(u => u.id === activeUnitId) + 1}</span>
                    <span className="whitespace-nowrap">DOKUMENTASI:</span> 
                    <span className="text-blue-500 truncate max-w-[150px] sm:max-w-none ml-1">{activeUnit.specificDetail || '(Tanpa Nama Unit)'}</span>
                  </h2>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <div className="px-3 py-1.5 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-full flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SEDANG DIEDIT</span>
                  </div>
                </div>
              </div>
            )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button onClick={() => document.getElementById('bulk')?.click()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                <Upload className="w-5 h-5" /> Unggah Banyak Foto Sekaligus
              </button>
              <input id="bulk" type="file" multiple accept="image/*" className="hidden" onChange={handleBulkPhotoUpload} />
              <button onClick={() => setAddCardModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                <Plus className="w-5 h-5" /> Tambah Kartu Manual
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {cards.map((card, idx) => (
                <div 
                  key={card.id} 
                  onClick={() => setFocusedCardId(card.id)}
                  className={`bg-slate-800/50 p-4 rounded-xl border relative group transition-all duration-300 ${
                    focusedCardId === card.id 
                    ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/50' 
                    : 'border-slate-700/50 hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Doc #{idx + 1}</span>
                    <button onClick={() => removeCard(card.id)} className="text-slate-500 hover:text-red-400 transition" title="Hapus Card"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="aspect-video bg-slate-900 rounded-lg mb-4 overflow-hidden relative border border-slate-700/50">
                    {card.photoBase64 ? (
                      <>
                        <img src={card.photoBase64} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDownloadPhoto(card.photoBase64!, card.description, idx)} className="p-2.5 bg-emerald-600/20 backdrop-blur-md rounded-lg hover:bg-emerald-600/30 transition shadow-xl" title="Download Foto"><Download className="w-4 h-4 text-emerald-400" /></button>
                          <button onClick={() => setEditingCardId(card.id)} className="p-2.5 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition shadow-xl" title="Edit/Crop"><Scissors className="w-4 h-4 text-white" /></button>
                          <button onClick={() => handlePhotoChange(card.id, null)} className="p-2.5 bg-red-600/20 backdrop-blur-md rounded-lg hover:bg-red-600/30 transition shadow-xl" title="Hapus Foto"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-slate-950 flex transition-all">
                        {(!userRole || userRole === 'engineer' || userRole === 'standby_engineer') ? (
                          <>
                            <button 
                              onClick={() => setActiveCameraCardId(card.id)}
                              className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-blue-600/10 transition-colors group/camera border-r border-slate-800/50"
                            >
                              <Camera className="w-7 h-7 text-slate-600 group-hover/camera:text-blue-400 transition-colors" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight group-hover/camera:text-slate-300">Ambil Foto</span>
                            </button>
                            
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-emerald-600/10 transition-colors group/upload">
                              <Upload className="w-7 h-7 text-slate-600 group-hover/upload:text-emerald-400 transition-colors" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight group-hover/upload:text-slate-300">Unggah Foto</span>
                              <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                            </label>
                          </>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/80 transition-colors group/upload">
                            <Upload className="w-8 h-8 text-slate-700 group-hover/upload:text-blue-500 transition-colors" />
                            <span className="text-[10px] text-slate-600 font-bold uppercase mt-2 group-hover/upload:text-slate-400">Unggah Foto</span>
                            <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  <textarea value={card.description} onChange={e => handleDescriptionChange(card.id, e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-700" rows={2} placeholder="Masukkan deskripsi dokumentasi..." />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 bg-slate-900/40 p-8 rounded-[2rem] border border-slate-700/30 backdrop-blur-xl">
              <button 
                onClick={handleManualSave} 
                className="px-10 py-4 bg-blue-600/20 text-blue-400 rounded-xl font-black flex items-center justify-center gap-3 border border-blue-500/30 hover:bg-blue-600/30 transition shadow-xl active:scale-95 text-sm sm:text-base"
              >
                <Save className="w-6 h-6" /> SIMPAN KE ARSIP DOKUMEN!
              </button>

              <button 
                onClick={() => setShowPreview(true)} 
                className="px-10 py-4 bg-emerald-600/20 text-emerald-400 rounded-xl font-black flex items-center justify-center gap-3 border border-emerald-500/30 hover:bg-emerald-600/30 transition shadow-xl active:scale-95 text-sm sm:text-base"
              >
                <Eye className="w-6 h-6" /> PREVIEW REPORT
              </button>

              <button 
                onClick={() => handleExportPDF()} 
                className="px-12 py-5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-red-600/30 hover:from-red-700 hover:to-rose-700 transition active:scale-95 text-base sm:text-lg border-b-4 border-red-900 active:border-b-0"
              >
                <FileType className="w-8 h-8" /> EXPORT PDF (SUB-REPORT {activeUnit?.specificDetail})
              </button>
            </div>
          </motion.div>
        ) : (
          <PreviewReport
            key="preview"
            maintenanceName={maintenanceName}
            maintenanceTime={maintenanceTime}
            specificDetail={(user?.email === 'vrv@gmail.com' && vrvUnitDetail)
              ? `${specificDetail.toUpperCase()} - ${vrvUnitDetail.toUpperCase()}`
              : specificDetail}
            cards={cards}
            companyType={companyType}
            userEmail={user?.email || ''}
            onBack={() => setShowPreview(false)}
            onExport={() => handleExportPDF()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addCardModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setAddCardModalOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} className="bg-slate-900 p-8 rounded-3xl border border-slate-700 w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2 text-center">Add Multiple Cards</h3>
              <p className="text-xs text-slate-500 text-center mb-6">How many documentation slots to add?</p>
              <input type="number" value={numberOfCardsToAdd} onChange={e => setNumberOfCardsToAdd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-center text-4xl font-bold mb-6 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" min="1" max="50" autoFocus />
              <div className="flex gap-4">
                <button onClick={() => setAddCardModalOpen(false)} className="flex-1 bg-slate-800 text-slate-400 p-3 rounded-xl font-bold hover:bg-slate-700 transition">Cancel</button>
                <button onClick={confirmAddCards} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">Add Slots</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingCardId && (
          <ImageEditor
            image={cards.find(c => c.id === editingCardId)?.photoBase64 || ''}
            onSave={base64 => handleApplyEdit(editingCardId, base64)}
            onCancel={() => setEditingCardId(null)}
            description={cards.find(c => c.id === editingCardId)?.description}
            maintenanceName={maintenanceName}
            specificDetail={specificDetail}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCameraCardId && (
          <CameraModal
            onCapture={(base64) => handleCapture(activeCameraCardId, base64)}
            onClose={() => setActiveCameraCardId(null)}
            description={cards.find(c => c.id === activeCameraCardId)?.description}
            maintenanceName={maintenanceName}
            specificDetail={specificDetail}
          />
        )}
      </AnimatePresence>


    </div>
  );
}