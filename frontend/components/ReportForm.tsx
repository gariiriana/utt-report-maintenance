import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Upload, Camera, FileType, Scissors, RefreshCw, Save, ChevronLeft, ChevronRight, X, Eye, Download, Loader2, Languages } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ExcelDocument } from '@/components/DocumentList';
import { ImageEditor } from '@/components/ImageEditor';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '@/api/firebase';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';

import {
  REPORT_TEMPLATES,
  VRV_TEMPLATE,
  AHHU_TEMPLATE,
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
import imgCommunicationSettingWld from '@/assets/Wld/communication_setting.jpeg';
import imgFgBbox2CablesFld from '@/assets/Fld/fg_bbox_2_cables.jpeg';
import imgTesPingFld from '@/assets/Fld/tes_ping_fld.jpeg';

const WLD_DEFAULT_PHOTOS: Record<string, string> = {
  'Status': imgStatusWld,
  'Test Ping': imgTestPingWld,
  'System Setting': imgSystemSettingWld,
  'Communication Setting': imgCommunicationSettingWld,
  'FG BBOX #2 CABLES': imgFgBbox2CablesFld,
};

export interface PhotoCard {
  id: string;
  photo: File | null;
  photoBase64?: string;
  description: string;
  parameter?: string;
}

export interface ReportUnit {
  id: string;
  tabName: string;
  specificDetail: string;
  vrvUnitDetail: string;
  templateMode?: 'indoor' | 'outdoor';
  archiveId?: string;
  archiveType?: 'pdf' | 'excel' | 'hse';
  cards: PhotoCard[];
  isExported?: boolean;
}

interface ReportFormProps {
  editingData?: ExcelDocument | null;
  onClearEdit?: () => void;
}

export function ReportForm({ editingData, onClearEdit }: ReportFormProps) {
  const { user, userRole, companyType: authCompanyType } = useAuth();
  const isDME = userRole === 'DME';
  const [companyType, setCompanyType] = useState<'neutra' | 'bri'>('neutra');
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');


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
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [translatingCardId, setTranslatingCardId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);



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

  const tabName = activeUnit?.tabName || '';
  const specificDetail = activeUnit?.specificDetail || '';
  const vrvUnitDetail = activeUnit?.vrvUnitDetail || '';

  const createDefaultCards = (count: number = 11) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${i + 1}`,
      photo: null,
      description: '',
      parameter: ''
    }));
  };  const getAccountTemplate = (email: string | undefined | null): string[] | null => {
    if (!email) return null;
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail === 'vrv@gmail.com') return VRV_TEMPLATE.indoor;
    if (lowerEmail === 'ahhu@utt.com') return AHHU_TEMPLATE.indoor;
    if (REPORT_TEMPLATES[lowerEmail]) return REPORT_TEMPLATES[lowerEmail];
    if (lowerEmail.includes('dock') || lowerEmail.includes('leveler')) {
      return REPORT_TEMPLATES['dockleveler@gmail.com'] || REPORT_TEMPLATES['dock'] || null;
    }
    if (lowerEmail.includes('ldb') || lowerEmail.includes('rdb')) {
      return REPORT_TEMPLATES['ldbrdb@gmail.com'] || null;
    }
    if (lowerEmail === 'lv@gmail.com') {
      return LV_ATS_TRAFO_TEMPLATE(lowerEmail);
    }
    return null;
  };

  const addNewUnit = async (name: string = '') => {
    const newId = Math.random().toString(36).substr(2, 9);
    let initialCards: PhotoCard[] = [];

    const template = getAccountTemplate(user?.email);
    if (template && template.length > 0) {
      const lowerEmail = user?.email?.toLowerCase() || '';
      if (lowerEmail === 'wld@gmail.com' || lowerEmail === 'fld@gmail.com') {
        initialCards = await Promise.all(template.map(async (desc, idx) => {
          let defaultUrl = WLD_DEFAULT_PHOTOS[desc];
          if (lowerEmail === 'fld@gmail.com' && desc === 'Test Ping') defaultUrl = imgTesPingFld;
          let b64 = defaultUrl ? await loadLogoBase64(defaultUrl) : undefined;
          return { id: `${idx + 1}`, photo: null, photoBase64: b64, description: desc, parameter: '' };
        }));
      } else {
        initialCards = template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc, parameter: '' }));
      }
    } else {
      initialCards = createDefaultCards(11);
    }

    const newUnit: ReportUnit = {
      id: newId,
      tabName: name || `Unit ${units.length + 1}`,
      specificDetail: '',
      vrvUnitDetail: '',
      templateMode: 'indoor',
      cards: initialCards
    };

    setUnits(prev => [...prev, newUnit]);
    setActiveUnitId(newId);
    return newId;
  };


  useEffect(() => {
    if (isDraftLoading || editingData || !user?.email) return;
    if (units.length === 0) {
      addNewUnit(`Unit 1`);
    }
  }, [isDraftLoading, units.length, editingData, user?.email]);

  useEffect(() => {
    if (authCompanyType) {
      setCompanyType(authCompanyType);
    }
  }, [authCompanyType]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [showPreview]);


  useEffect(() => {
    if (!user?.email || editingData) {
      setIsDraftLoading(false);
      return;
    }

    const loadDraft = async () => {
      let saved = await draftStorage.get('report_form_draft_v2');

      if (!saved) {
        const legacySaved = localStorage.getItem('report_form_draft_v2');
        if (legacySaved) {
          try {
            saved = JSON.parse(legacySaved);
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
          if (draft.userEmail?.toLowerCase() === user.email?.toLowerCase() && draft.units && draft.units.length > 0) {
            setMaintenanceName(draft.maintenanceName || '');
            setMaintenanceTime(draft.maintenanceTime || '');
            if (draft.companyType) setCompanyType(draft.companyType);

            const template = getAccountTemplate(user?.email);

            const processedUnits = await Promise.all(draft.units.map(async (u: any) => {
              let unitCards = u.cards.map((c: any) => ({ ...c, photo: null }));
              if (template && template.length > 0) {
                unitCards = template.map((desc, idx) => {
                  const existing = unitCards.find((c: any) => c.description === desc) || unitCards[idx];
                  return {
                    id: `${idx + 1}`,
                    photo: null,
                    photoBase64: existing?.photoBase64 || undefined,
                    description: desc,
                    parameter: existing?.parameter || ''
                  };
                });
              }
              return { ...u, cards: unitCards };
            }));

            setUnits(processedUnits);
            setActiveUnitId(draft.units[0].id);
            setIsDraftLoading(false);
            return;
          }
        } catch (err) {
          console.error('Failed to process draft:', err);
        }
      }

      const template = getAccountTemplate(user?.email);
      let initialCards: PhotoCard[] = [];
      if (template && template.length > 0) {
        initialCards = template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc, parameter: '' }));
      } else {
        initialCards = createDefaultCards(11);
      }

      const initialUnit: ReportUnit = {
        id: Math.random().toString(36).substr(2, 9),
        tabName: 'Unit 1',
        specificDetail: '',
        vrvUnitDetail: '',
        templateMode: 'indoor',
        cards: initialCards
      };

      setUnits([initialUnit]);
      setActiveUnitId(initialUnit.id);
      setIsDraftLoading(false);
    };

    loadDraft();
  }, [user?.email, editingData]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDME) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }


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
  }, [focusedCardId, cardClipboard, cards, activeUnitId, isDME]);


  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (isDME) return;
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
  }, [focusedCardId, activeUnitId, isDME]);

  const setTemplateMode = (mode: 'indoor' | 'outdoor') => {
    if (!activeUnitId) return;
    setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, templateMode: mode } : u));
  };

  useEffect(() => {
    const lowerEmail = user?.email?.toLowerCase() || '';
    if (editingData || (lowerEmail !== 'vrv@gmail.com' && lowerEmail !== 'ahhu@utt.com') || isDraftLoading) return;

    const hasExistingPhotos = cards.some(c => c.photoBase64);
    if (hasExistingPhotos) return;

    const currentMode = activeUnit?.templateMode || 'indoor';
    const isOutdoor = currentMode === 'outdoor';
    let template: string[] | null = null;

    if (lowerEmail === 'vrv@gmail.com') {
      template = isOutdoor ? VRV_TEMPLATE.outdoor : VRV_TEMPLATE.indoor;
    } else if (lowerEmail === 'ahhu@utt.com') {
      template = isOutdoor ? AHHU_TEMPLATE.outdoor : AHHU_TEMPLATE.indoor;
    }

    if (template) {
      setCards(template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    }
  }, [activeUnit?.templateMode, user?.email, editingData, isDraftLoading]);

  useEffect(() => {
    if (editingData) {
      setMaintenanceName(editingData.maintenanceName);
      setMaintenanceTime(editingData.maintenanceTime);

      let finalSpec = editingData.specificDetail || '';
      let finalVrv = '';

      if (user?.email === 'vrv@gmail.com' && editingData.specificDetail?.includes(' - ')) {
        const [type, ...rest] = editingData.specificDetail.split(' - ');
        finalSpec = type.toLowerCase();
        finalVrv = rest.join(' - ');
      }

      const photos = (editingData.photosData?.length > 0)
        ? editingData.photosData.map((p: any) => ({
          id: `${p.index}`,
          photo: null,
          photoBase64: p.photoBase64 || null,
          description: p.description || ''
        }))
        : createDefaultCards(11);


      const editUnit: ReportUnit = {
        id: `edit-${Date.now()}`,
        tabName: (finalSpec || 'Edit').toUpperCase(),
        specificDetail: finalSpec,
        vrvUnitDetail: finalVrv,
        archiveId: editingData.id,
        archiveType: editingData.documentType,
        cards: photos
      };

      setUnits([editUnit]);
      setActiveUnitId(editUnit.id);
    }
  }, [editingData]);

  useEffect(() => {
    if (editingData || !user?.email || isDraftLoading || isExporting) return;

    const saveDraft = async () => {
      const draft = {
        userEmail: user.email,
        maintenanceName,
        maintenanceTime,
        companyType,
        units: units
          .filter(u => !u.isExported)
          .map(u => ({
            ...u,
            cards: u.cards.map(c => ({
              id: c.id,
              description: c.description,
              photoBase64: c.photoBase64,
              parameter: c.parameter || ''
            }))
          })),
        timestamp: new Date().getTime()
      };

      try {
        await draftStorage.set('report_form_draft_v2', draft);
      } catch (err) {
        console.error('Storage error:', err);
      }
    };

    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [maintenanceName, maintenanceTime, companyType, units, user?.email, editingData, isDraftLoading, isExporting]);

  const handlePhotoChange = async (id: string, file: File | null) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) return toast.error('Ukuran foto maksimal 10MB');
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const toastId = toast.loading(`Memproses ${files.length} foto...`);
    let successCount = 0;
    let failCount = 0;
    const MAX_SIZE = 20 * 1024 * 1024;

    try {
      const results: { file: File; base64: string }[] = [];


      const batchSize = 3;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(batch.map(async (file) => {
          if (file.size > MAX_SIZE) {
            failCount++;
            return;
          }
          try {
            const b64 = await compressImage(file);
            results.push({ file, base64: b64 });
            successCount++;
          } catch (err) {
            console.error('Compression failed:', err);
            failCount++;
          }
        }));

        const totalProcessed = successCount + failCount;
        toast.loading(`Memproses: ${totalProcessed} / ${files.length} foto...`, { id: toastId });
      }

      if (successCount > 0) {
        setCards(prev => {
          const newCards = [...prev];
          let resultIdx = 0;


          for (let i = 0; i < newCards.length && resultIdx < results.length; i++) {
            if (!newCards[i].photoBase64 && !newCards[i].photo) {
              newCards[i] = {
                ...newCards[i],
                photo: results[resultIdx].file,
                photoBase64: results[resultIdx].base64
              };
              resultIdx++;
            }
          }


          while (resultIdx < results.length) {
            const maxId = newCards.length > 0 ? Math.max(...newCards.map(c => parseInt(c.id) || 0)) : 0;
            newCards.push({
              id: (maxId + 1).toString(),
              photo: results[resultIdx].file,
              photoBase64: results[resultIdx].base64,
              description: ''
            });
            resultIdx++;
          }

          return newCards;
        });
      }

      if (failCount > 0) {
        toast.error(`${successCount} berhasil, ${failCount} gagal (Pastikan ukuran file < 20MB)`, {
          id: toastId,
          duration: 5000
        });
      } else if (successCount > 0) {
        toast.success(`Berhasil mengunggah ${successCount} foto!`, { id: toastId });
      } else {
        toast.error('Tidak ada foto yang berhasil diproses', { id: toastId });
      }

    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.error('Terjadi kesalahan sistem saat memproses foto', { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyEdit = (id: string, editedBase64: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, photoBase64: editedBase64 } : c));
    setEditingCardId(null);
    toast.success('Photo updated');
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, description } : c));
  };



  const handleTranslateCardDescription = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || !card.description) {
      toast.error('Masukkan deskripsi foto terlebih dahulu untuk diterjemahkan');
      return;
    }

    setTranslatingCardId(cardId);
    const toastId = toast.loading('Menerjemahkan deskripsi dengan AI...');
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = apiBaseUrl ? (apiBaseUrl.endsWith('/api') ? `${apiBaseUrl}/ai/chat` : `${apiBaseUrl}/api/ai/chat`) : '/api/ai/chat';

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Translate the following maintenance photo description to English if it is in Indonesian, or to Indonesian if it is in English. Return ONLY the translation text without quotes or explanations:\n"${card.description}"`
            }
          ]
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const translatedText = data.reply.trim().replace(/^["']|["']$/g, '');
        handleDescriptionChange(cardId, translatedText);
        toast.success('Deskripsi berhasil diterjemahkan!', { id: toastId });
      } else {
        toast.error(data.error || 'Gagal menerjemahkan deskripsi', { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal terhubung ke layanan penerjemah', { id: toastId });
    } finally {
      setTranslatingCardId(null);
    }
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
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
    setIsSaving(true);

    // Helpers
    const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
    };

    const chunkArray = <T,>(array: T[], size: number): T[][] => {
      const chunked: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
      }
      return chunked;
    };

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
      };

      if (!editingData) {
        reportData.createdBy = user?.email?.toLowerCase();
        reportData.createdAt = serverTimestamp();
      }

      const effectiveDocId = unit.archiveId || (editingData ? editingData.id : null);
      const effectiveDocType = unit.archiveType || (editingData ? editingData.documentType : 'pdf');
      const collectionName = effectiveDocType === 'excel' ? 'excel_documents' : (effectiveDocType === 'hse' ? 'hse' : 'pdf_documents');

      const apiUrl = import.meta.env.VITE_API_URL;
      const isOnline = navigator.onLine;
      if (isOnline && apiUrl && !effectiveDocId) {
        const photos = cardsToSave.map((card, i) => ({
          index: i + 1,
          photoBase64: card.photoBase64 || '',
          description: card.description || '',
          parameter: card.parameter || '',
          hasPhoto: !!card.photoBase64
        }));
        const docIdFromAPI = await saveReportViaAPI(apiUrl, collectionName, reportData, photos);
        if (docIdFromAPI) {
          setUnits(prev => prev.map(u => u.id === unit.id ? { ...u, archiveId: docIdFromAPI, archiveType: 'pdf' } : u));
          toast.success(`Unit ${unit.specificDetail} disimpan (via API)`, { id: toastId });
          return docIdFromAPI;
        }
      }

      let docId = '';
      if (effectiveDocId) {
        docId = effectiveDocId;
        await withRetry(() => updateDoc(doc(db, collectionName, docId), reportData));
        const photosRef = collection(db, `${collectionName}/${docId}/photos`);
        const existingPhotos = await getDocs(photosRef);
        if (!existingPhotos.empty) {
          await Promise.all(existingPhotos.docs.map(photoDoc =>
            deleteDoc(doc(db, `${collectionName}/${docId}/photos`, photoDoc.id))
          ));
        }
      } else {
        const docRef = await withRetry(() => addDoc(collection(db, 'pdf_documents'), reportData));
        docId = docRef.id;
        setUnits(prev => prev.map(u => u.id === unit.id ? { ...u, archiveId: docId, archiveType: 'pdf' } : u));
      }

      if (cardsToSave.length > 0) {
        const photosRef = collection(db, `${effectiveDocId ? collectionName : 'pdf_documents'}/${docId}/photos`);
        const chunks = chunkArray(cardsToSave, 3);

        for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
          const batch = chunks[batchIdx];
          const startIdx = batchIdx * 3 + 1;
          const endIdx = startIdx + batch.length - 1;

          if (toastId) {
            toast.loading(`Menyimpan foto ${startIdx}-${endIdx} dari ${cardsToSave.length}...`, { id: toastId });
          }

          await Promise.all(batch.map(async (card, i) => {
            const currentIdx = startIdx + i;
            try {
              let b64 = card.photoBase64 || '';

              if (b64) {
                const sizeInKB = (b64.length * 3) / 4 / 1024;
                // Aggressive compression: if > 600KB or if it fails once, we compress more
                if (sizeInKB > 600) {
                  try {
                    b64 = await compressBase64Image(b64, { maxWidth: 800, quality: 0.5 });
                  } catch (err) {
                    console.error(`Compression failure for photo ${currentIdx}`, err);
                  }
                }
              }

              await withRetry(async () => {
                await addDoc(photosRef, {
                  index: currentIdx,
                  photoBase64: b64,
                  description: card.description || '',
                  parameter: card.parameter || '',
                  hasPhoto: !!b64,
                  savedAt: serverTimestamp()
                });
              });
            } catch (err: any) {
              console.error(`Failed to save photo ${currentIdx}:`, err);
              // Warn but don't stop the whole process
              toast.error(`Foto #${currentIdx} gagal disimpan: ${err.message || 'Limit size/Network'}`, { duration: 4000 });
            }
          }));
        }
      }

      toast.success(`Unit ${unit.specificDetail} berhasil disimpan`, { id: toastId });
      return docId;
    } catch (error: any) {
      console.error('Firestore save error:', error);
      let errorMsg = 'Gagal simpan';
      if (error.code === 'permission-denied') errorMsg = 'Gagal simpan: Akses ditolak (Cek Login)';
      else if (error.code === 'resource-exhausted') errorMsg = 'Gagal simpan: File terlalu besar (Limit Firestore)';
      else if (error.message?.includes('too large')) errorMsg = 'Gagal simpan: Ukuran dokumen melebihi 1MB';

      toast.error(errorMsg, { id: toastId });
      return null;
    } finally {
      setIsSaving(false);
    }
  };



  const handleExportPDF = async (unit?: ReportUnit) => {
    const targetUnit = unit || activeUnit;
    if (!targetUnit) return toast.error('Unit tidak terpilih');

    setIsExporting(true);
    const toastId = toast.loading(isDME ? 'Memproses export PDF...' : 'Memproses export PDF & Menyimpan data...');
    try {
      const result = await generatePDFDocument(targetUnit);
      if (result) {
        const { doc, fileName } = result;

        if (isDME) {
          doc.save(fileName);
          toast.success("Laporan berhasil diekspor!", { id: toastId });
        } else {
          const saveResult = await saveReportToFirestore(targetUnit, result);
          if (saveResult) {
            if (onClearEdit) onClearEdit();
            doc.save(fileName);

            setUnits(prev => {
              const newUnits = prev.map(u => u.id === targetUnit.id ? { ...u, isExported: true } : u);

              const draft = {
                userEmail: user?.email,
                maintenanceName,
                maintenanceTime,
                companyType,
                units: newUnits
                  .filter(u => !u.isExported)
                  .map(u => ({
                    ...u,
                    cards: u.cards.map(c => ({
                      id: c.id,
                      description: c.description,
                      photoBase64: c.photoBase64,
                      parameter: c.parameter || ''
                    }))
                  })),
                timestamp: new Date().getTime()
              };
              draftStorage.set('report_form_draft_v2', draft).catch(console.error);

              return newUnits;
            });

            toast.success("Laporan berhasil diekspor & disimpan!", { id: toastId });
          } else {
            toast.error("Gagal menyimpan data ke database. PDF tidak diunduh.", { id: toastId });
          }
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Terjadi kesalahan saat export PDF", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };




  const handleManualSave = async () => {
    if (!activeUnit) return;
    const result = await saveReportToFirestore(activeUnit);
    if (result) {
      if (onClearEdit) onClearEdit();
      let freshCards = createDefaultCards(11);
      const template = getAccountTemplate(user?.email);
      if (template && template.length > 0) {
        const lowerEmail = user?.email?.toLowerCase() || '';
        if (lowerEmail === 'wld@gmail.com' || lowerEmail === 'fld@gmail.com') {
          freshCards = await Promise.all(template.map(async (desc, idx) => {
            let defaultUrl = WLD_DEFAULT_PHOTOS[desc];
            if (lowerEmail === 'fld@gmail.com' && desc === 'Test Ping') defaultUrl = imgTesPingFld;
            let b64 = defaultUrl ? await loadLogoBase64(defaultUrl) : undefined;
            return { id: `${idx + 1}`, photo: null, photoBase64: b64, description: desc, parameter: '' };
          }));
        } else {
          freshCards = template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc, parameter: '' }));
        }
      }

      const newUnitId = Math.random().toString(36).substr(2, 9);
      setUnits(prev => prev.map(u => {
        if (u.id === activeUnit.id) {
          return {
            ...u,
            id: newUnitId,
            archiveId: undefined,
            archiveType: undefined,
            specificDetail: '',
            vrvUnitDetail: '',
            tabName: `Unit ${prev.indexOf(u) + 1}`,
            templateMode: 'indoor',
            isExported: false,
            cards: freshCards
          };
        }
        return u;
      }));
      setActiveUnitId(newUnitId);

      toast.success('Form direset untuk report baru!', { icon: '🔄', duration: 3000 });
    }
  };

  const uploadedCount = cards.filter(c => c.photoBase64).length;


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 relative z-10">
      <AnimatePresence mode="wait">
        {!showPreview ? (
          <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
              <div className="flex gap-3">
                <div className="bg-white/80 backdrop-blur-xl p-2.5 sm:p-3 rounded-xl border border-sky-100/80 shadow-sm min-w-[100px]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Foto</p>
                  <p className="text-base sm:text-lg font-black text-slate-900">{uploadedCount} / {cards.length}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl p-2.5 sm:p-3 rounded-xl border border-sky-100/80 shadow-sm min-w-[100px]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Template</p>
                  <p className="text-base sm:text-lg font-black text-blue-600 uppercase">{companyType}</p>
                </div>
              </div>
              {editingData && (
                <button onClick={onClearEdit} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 transition-all shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5" /> Batal Edit
                </button>
              )}
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-sky-100/90 shadow-lg shadow-sky-900/5 mb-5 font-geist">

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <label htmlFor="maintenance-name" className="block text-xs font-bold text-slate-700 mb-1">Nama Maintenance</label>
                  <input
                    id="maintenance-name"
                    title="Nama Maintenance"
                    type="text"
                    value={maintenanceName}
                    onChange={e => setMaintenanceName(e.target.value)}
                    disabled={isDME}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm text-slate-900 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder-slate-400 disabled:opacity-70 disabled:cursor-not-allowed"
                    placeholder="cth. Maintenance Bulanan"
                  />
                </div>
                <div>
                  <label htmlFor="specific-detail" className="block text-xs font-bold text-slate-700 mb-1">Detail Unit Maintenance</label>
                  <input
                    id="specific-detail"
                    title="Detail Unit Maintenance"
                    type="text"
                    value={specificDetail}
                    onChange={(e) => setSpecificDetail(e.target.value)}
                    disabled={isDME}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm text-blue-600 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder-slate-400 disabled:opacity-70 disabled:cursor-not-allowed"
                    placeholder="cth. FCU-01 / VRV-02"
                  />
                </div>
                <div>
                  <label htmlFor="maintenance-time" className="block text-sm font-bold text-slate-700 mb-2">Waktu Maintenance</label>
                  <input
                    id="maintenance-time"
                    title="Waktu Maintenance"
                    placeholder="Pilih tanggal"
                    type="date"
                    value={maintenanceTime}
                    onChange={(e) => setMaintenanceTime(e.target.value)}
                    disabled={isDME}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="company-type" className="block text-sm font-bold text-slate-700 mb-2">Situs / Proyek</label>
                  <select
                    id="company-type"
                    title="Situs / Proyek"
                    value={companyType}
                    onChange={e => setCompanyType(e.target.value as 'neutra' | 'bri')}
                    disabled={isDME}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer pr-10 disabled:opacity-70 disabled:cursor-not-allowed transition"
                  >
                    <option value="neutra">NeutraDC</option>
                    <option value="bri">Bank BRI</option>
                  </select>
                </div>
              </div>


              <div className="mt-8 select-none">
                {/* Desktop Tab Bar */}
                <div className="hidden md:flex items-center bg-slate-100/90 backdrop-blur-md border border-slate-200 rounded-t-xl overflow-hidden h-10 shadow-sm">
                  <div className="flex items-center px-2 border-r border-slate-200 gap-1 shrink-0">
                    <button onClick={() => scrollTabs('left')} title="Geser Tab Kiri" aria-label="Geser tab ke kiri" className="p-1.5 hover:bg-slate-200 transition-colors rounded-lg text-slate-600 hover:text-blue-600"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => scrollTabs('right')} title="Geser Tab Kanan" aria-label="Geser tab ke kanan" className="p-1.5 hover:bg-slate-200 transition-colors rounded-lg text-slate-600 hover:text-blue-600"><ChevronRight className="w-4 h-4" /></button>
                  </div>

                  <div ref={tabContainerRef} className="flex-1 flex items-end overflow-x-auto no-scrollbar h-full scroll-smooth">
                    {units.map((unit, idx) => (
                      <div
                        key={unit.id}
                        onClick={() => setActiveUnitId(unit.id)}
                        className={`group relative flex items-center min-w-[110px] sm:min-w-[140px] h-full px-3 sm:px-5 cursor-pointer transition-all duration-200 border-r border-slate-200 shrink-0 ${activeUnitId === unit.id
                            ? 'bg-white z-10 shadow-sm'
                            : 'bg-transparent hover:bg-slate-200/50'
                          }`}
                      >
                        {activeUnitId === unit.id ? (
                          <div className="flex items-center gap-2 sm:gap-3 w-full">
                            <input
                              autoFocus
                              title="Nama Unit"
                              value={tabName}
                              onChange={(e) => setTabName(e.target.value)}
                              disabled={isDME}
                              className="bg-transparent border-none outline-none text-blue-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider w-full disabled:cursor-not-allowed"
                              placeholder="NAMA UNIT..."
                            />
                            {!isDME && units.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (units.length > 1) {
                                    const targetUnit = units.find(u => u.id === unit.id);
                                    const unitName = targetUnit?.tabName || `Unit ${idx + 1}`;
                                    if (window.confirm(`Yakin ingin menghapus "${unitName}" beserta seluruh fotonya?`)) {
                                      setUnits(prev => prev.filter(u => u.id !== unit.id));
                                      if (activeUnitId === unit.id) setActiveUnitId(units[idx === 0 ? 1 : idx - 1].id);
                                      toast.success('Unit berhasil dihapus');
                                    }
                                  }
                                }}
                                title="Hapus Unit"
                                aria-label="Hapus unit ini"
                                className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                              >
                                <X className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <span className="text-slate-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider truncate group-hover:text-slate-900">
                              {unit.tabName || `Unit ${idx + 1}`}
                            </span>
                          </div>
                        )}

                        {activeUnitId === unit.id && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                        )}
                      </div>
                    ))}
                  </div>

                  {!isDME && (
                    <div className="flex items-center px-1 border-l border-slate-200 shrink-0 bg-slate-100">
                      <button
                        onClick={() => addNewUnit(`Unit ${units.length + 1}`)}
                        className="p-2 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all rounded-lg"
                        title="Tambah Unit Baru"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Dropdown & Edit Block */}
                <div className="block md:hidden space-y-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-lg">
                  <div>
                    <label htmlFor="mobile-unit-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Pilih Unit Maintenance
                    </label>
                    <select
                      id="mobile-unit-select"
                      value={activeUnitId || ''}
                      onChange={(e) => setActiveUnitId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-xs"
                    >
                      {units.map((unit, idx) => (
                        <option key={unit.id} value={unit.id} className="bg-white">
                          {unit.tabName || `Unit ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isDME && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addNewUnit(`Unit ${units.length + 1}`)}
                        className="flex-1 py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (units.length > 1) {
                            const currentUnit = units.find(u => u.id === activeUnitId);
                            const unitLabel = currentUnit?.tabName || 'Unit ini';
                            if (window.confirm(`Yakin ingin menghapus "${unitLabel}" beserta seluruh fotonya?`)) {
                              const idx = units.findIndex(u => u.id === activeUnitId);
                              setUnits(prev => prev.filter(u => u.id !== activeUnitId));
                              setActiveUnitId(units[idx === 0 ? 1 : idx - 1].id);
                              toast.success('Unit berhasil dihapus');
                            }
                          } else {
                            toast.error('Minimal harus ada 1 unit');
                          }
                        }}
                        className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Hapus Unit
                      </button>
                    </div>
                  )}

                  {!isDME && (
                    <div className="pt-3 border-t border-slate-200">
                      <label htmlFor="mobile-unit-rename" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Ubah Nama Unit Aktif
                      </label>
                      <input
                        id="mobile-unit-rename"
                        type="text"
                        value={tabName}
                        onChange={(e) => setTabName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-blue-600 font-bold rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        placeholder="Masukkan nama unit..."
                      />
                    </div>
                  )}
                </div>

                <div className="h-1 bg-slate-200/60 border-b border-slate-200 mb-10 shadow-sm" />
              </div>


              {activeUnit && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 px-2 gap-4">
                  <div className="flex-1 flex flex-wrap items-center gap-3 sm:gap-4">
                    <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded-md flex items-center justify-center font-mono font-bold">#{units.findIndex(u => u.id === activeUnitId) + 1}</span>
                      <span className="whitespace-nowrap">DOKUMENTASI:</span>
                      <span className="text-blue-600 truncate max-w-[150px] sm:max-w-none ml-1">{activeUnit.specificDetail || '(Tanpa Nama Unit)'}</span>
                    </h2>

                    {(user?.email?.toLowerCase() === 'ahhu@utt.com' || user?.email?.toLowerCase() === 'vrv@gmail.com') && (
                      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          onClick={() => setTemplateMode('indoor')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all ${activeUnit?.templateMode === 'indoor' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          INDOOR
                        </button>
                        <button
                          onClick={() => setTemplateMode('outdoor')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all ${activeUnit?.templateMode === 'outdoor' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          OUTDOOR
                        </button>
                      </div>
                    )}
                  </div>
                  {userRole !== 'engineer' && userRole !== 'standby_engineer' && (
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full flex items-center gap-2 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">SEDANG DIEDIT</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isDME && (
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button onClick={() => document.getElementById('bulk')?.click()} className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white p-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                  <Upload className="w-5 h-5" /> Unggah Banyak Foto Sekaligus
                </button>
                <input id="bulk" title="Unggah banyak foto" type="file" multiple accept="image/*" className="hidden" onChange={handleBulkPhotoUpload} />
                <button onClick={() => setAddCardModalOpen(true)} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white p-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                  <Plus className="w-5 h-5" /> Tambah Kartu Manual
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  onClick={() => setFocusedCardId(card.id)}
                  className={`bg-white p-3 sm:p-4 rounded-2xl border relative group transition-all duration-300 shadow-md ${focusedCardId === card.id
                      ? 'border-blue-500 shadow-blue-500/10 ring-2 ring-blue-500/30'
                      : 'border-sky-100 hover:border-blue-300 hover:shadow-lg'
                    }`}
                >
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 tracking-wider uppercase">Doc #{idx + 1}</span>
                    {!isDME && (
                      <button onClick={() => removeCard(card.id)} className="text-slate-500 hover:text-red-400 transition" title="Hapus Card"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                    )}
                  </div>
                  <div className="aspect-video bg-slate-100 rounded-lg mb-2 sm:mb-4 overflow-hidden relative border border-slate-200">
                    {card.photoBase64 ? (
                      <>
                        <img src={card.photoBase64} alt={card.description || `Foto dokumentasi ${idx + 1}`} title={card.description || `Foto dokumentasi ${idx + 1}`} className="w-full h-full object-cover" />
                        <div
                          onClick={() => setPreviewImage({ src: card.photoBase64!, title: card.description || `Doc #${idx + 1}` })}
                          className="absolute inset-0 bg-black/20 flex items-center justify-center gap-1.5 sm:gap-3 opacity-100 transition-opacity cursor-zoom-in"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({ src: card.photoBase64!, title: card.description || `Doc #${idx + 1}` });
                            }}
                            className="p-1.5 sm:p-2.5 bg-blue-600/20 backdrop-blur-md rounded-lg hover:bg-blue-600/30 transition shadow-xl"
                            title="Detail Foto"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPhoto(card.photoBase64!, card.description, idx);
                            }}
                            className="p-1.5 sm:p-2.5 bg-emerald-600/20 backdrop-blur-md rounded-lg hover:bg-emerald-600/30 transition shadow-xl"
                            title="Download Foto"
                          >
                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                          </button>
                          {!isDME && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCardId(card.id);
                                }}
                                className="p-1.5 sm:p-2.5 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition shadow-xl"
                                title="Edit/Crop"
                              >
                                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhotoChange(card.id, null);
                                }}
                                className="p-1.5 sm:p-2.5 bg-red-600/20 backdrop-blur-md rounded-lg hover:bg-red-600/30 transition shadow-xl"
                                title="Hapus Foto"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-slate-50 border border-dashed border-sky-200 rounded-lg flex transition-all">
                        {isDME ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-tight">Tidak ada foto</span>
                          </div>
                        ) : (!userRole || userRole === 'engineer' || userRole === 'standby_engineer') ? (
                          <>
                            <button
                              onClick={() => setActiveCameraCardId(card.id)}
                              className="flex-1 flex flex-col items-center justify-center gap-1 sm:gap-2 hover:bg-blue-100/60 transition-colors group/camera border-r border-sky-200/80"
                            >
                              <Camera className="w-5.5 h-5.5 sm:w-7 sm:h-7 text-slate-500 group-hover/camera:text-blue-600 transition-colors" />
                              <span className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tight group-hover/camera:text-blue-600">Ambil Foto</span>
                            </button>

                            <label className="flex-1 flex flex-col items-center justify-center gap-1 sm:gap-2 cursor-pointer hover:bg-emerald-100/60 transition-colors group/upload">
                              <Upload className="w-5.5 h-5.5 sm:w-7 sm:h-7 text-slate-500 group-hover/upload:text-emerald-600 transition-colors" />
                              <span className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tight group-hover/upload:text-emerald-600">Unggah Foto</span>
                              <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                            </label>
                          </>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-sky-100/80 transition-colors group/upload">
                            <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 group-hover/upload:text-blue-600 transition-colors" />
                            <span className="text-[8px] sm:text-[10px] text-slate-600 font-bold uppercase mt-1 group-hover/upload:text-blue-600">Unggah Foto</span>
                            <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="relative w-full">
                    <textarea title="Deskripsi Foto" value={card.description} onChange={e => handleDescriptionChange(card.id, e.target.value)} disabled={isDME || translatingCardId === card.id} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 pr-9 sm:p-3 sm:pr-10 text-xs sm:text-sm text-slate-900 font-medium outline-none focus:bg-white focus:border-blue-500 transition placeholder:text-slate-400 disabled:opacity-75 disabled:cursor-not-allowed" rows={2} placeholder="Masukkan deskripsi dokumentasi..." />
                    {(user?.email === 'ats@gmail.com' || user?.email === 'pju@gmail.com' || user?.email === 'pdu@gmail.com' || user?.email === 'coolingtower@gmail.com' || user?.email === 'generator@gmail.com' || user?.email === 'acsplit@gmail.com' || user?.email === 'trafo@gmail.com' || user?.email === 'busduct@gmail.com' || user?.email === 'dockleveler@gmail.com' || user?.email === 'door@gmail.com' || user?.email === 'capacitorbank@gmail.com' || user?.email === 'ldbrdb@gmail.com' || user?.email === 'ldb/rdb@gmail.com' || user?.email === 'ldb@gmail.com') && (
                      <button
                        type="button"
                        onClick={() => handleTranslateCardDescription(card.id)}
                        disabled={isDME || translatingCardId !== null || !card.description}
                        className="absolute top-2 right-2 p-1.5 bg-blue-50 border border-blue-200 text-blue-600 hover:text-white hover:bg-blue-600 rounded-md transition active:scale-95 disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-sm"
                        title="Translate Deskripsi (EN ⇄ ID)"
                      >
                        {translatingCardId === card.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Languages className="w-3.5 h-3.5 text-blue-600 hover:text-white" />
                        )}
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch justify-center gap-2 sm:gap-3 mt-12 bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-[2rem] border border-sky-100/90 shadow-2xl shadow-sky-900/10 w-full">
              {!isDME && (
                <button
                  onClick={handleManualSave}
                  disabled={isSaving || isExporting}
                  className={`col-span-1 sm:flex-1 sm:min-w-[140px] py-3.5 px-2 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 shadow-sm transition active:scale-95 text-[10px] sm:text-xs group cursor-pointer ${(isSaving || isExporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-slate-600" />
                  ) : (
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-active:scale-90 transition-transform" />
                  )}
                  <span className="text-center leading-tight">SIMPAN KE ARSIP</span>
                </button>
              )}

              <button
                onClick={() => setShowPreview(true)}
                disabled={isSaving || isExporting}
                className={`col-span-1 sm:flex-1 sm:min-w-[140px] py-3.5 px-2 bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 shadow-sm transition active:scale-95 text-[10px] sm:text-xs group cursor-pointer ${(isSaving || isExporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 group-active:scale-90 transition-transform" />
                <span className="text-center leading-tight">PREVIEW DOKUMENTASI</span>
              </button>



              <button
                onClick={() => handleExportPDF()}
                disabled={isSaving || isExporting}
                className={`col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-[140px] py-3.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition active:scale-95 text-[10px] sm:text-xs group cursor-pointer ${(isSaving || isExporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <FileType className="w-4 h-4 sm:w-5 sm:h-5 group-active:scale-90 transition-transform" />
                )}
                <span className="text-center leading-tight">
                  {isExporting ? 'EXPORTING...' : 'EXPORT DOKUMENTASI (FOTO)'}
                </span>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md" onClick={() => setAddCardModalOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl border border-sky-100 w-full max-w-sm shadow-2xl text-slate-800">
              <h3 className="text-xl font-black text-slate-900 mb-2 text-center">Tambah Kartu Foto</h3>
              <p className="text-xs text-slate-500 text-center mb-6 font-medium">Berapa banyak slot foto yang ingin ditambahkan?</p>
              <input type="number" title="Jumlah kartu yang ingin ditambahkan" placeholder="Masukkan angka" value={numberOfCardsToAdd} onChange={e => setNumberOfCardsToAdd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 text-center text-4xl font-black mb-6 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" min="1" max="50" autoFocus />
              <div className="flex gap-4">
                <button onClick={() => setAddCardModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-200">Batal</button>
                <button onClick={confirmAddCards} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">Tambah Slot</button>
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

      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8 cursor-zoom-out"
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50 cursor-pointer"
              title="Tutup Preview"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image Wrapper */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center justify-center"
            >
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/10"
              />
              {previewImage.title && (
                <div className="mt-4 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-800 text-center max-w-md">
                  <p className="text-white text-sm font-semibold">{previewImage.title}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}

