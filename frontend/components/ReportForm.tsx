import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Upload, Camera, FileType, Scissors, Eye, RefreshCw, ChevronDown, Save } from 'lucide-react';
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

export interface PhotoCard {
  id: string;
  photo: File | null;
  photoBase64?: string;
  description: string;
}

interface ReportFormProps {
  editingData?: ExcelDocument | null;
  onClearEdit?: () => void;
}

export function ReportForm({ editingData, onClearEdit }: ReportFormProps) {
  const { user, companyType: authCompanyType } = useAuth();
  const [companyType, setCompanyType] = useState<'neutra' | 'bri'>('neutra');
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');
  const [specificDetail, setSpecificDetail] = useState('');
  const [vrvUnitDetail, setVrvUnitDetail] = useState('');
  const [cards, setCards] = useState<PhotoCard[]>([
    { id: '1', photo: null, description: '' },
    { id: '2', photo: null, description: '' },
    { id: '3', photo: null, description: '' },
    { id: '4', photo: null, description: '' },
    { id: '5', photo: null, description: '' },
    { id: '6', photo: null, description: '' },
    { id: '7', photo: null, description: '' },
    { id: '8', photo: null, description: '' },
    { id: '9', photo: null, description: '' },
  ]);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [numberOfCardsToAdd, setNumberOfCardsToAdd] = useState('1');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (authCompanyType) {
      setCompanyType(authCompanyType);
    }
  }, [authCompanyType]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [showPreview]);


  useEffect(() => {
    if (!user?.email || editingData) return;

    const lowerEmail = user.email.toLowerCase();

    let template: string[] | null = null;
    if (lowerEmail === 'vrv@gmail.com') {
      if (!maintenanceName) setMaintenanceName('vrv');
      template = VRV_TEMPLATE.indoor;
    } else if (['lv@gmail.com', 'ats@gmail.com', 'trafo@gmail.com'].includes(lowerEmail)) {
      const isTrafo = lowerEmail === 'trafo@gmail.com';
      setMaintenanceName(isTrafo ? 'Trafo' : (lowerEmail === 'lv@gmail.com' ? 'LV' : 'ATS'));
      template = LV_ATS_TRAFO_TEMPLATE(lowerEmail);
    } else {
      template = REPORT_TEMPLATES[lowerEmail];
      if (!template && (lowerEmail.includes('dock') || lowerEmail.includes('leveler'))) {
        template = REPORT_TEMPLATES['dock'];
      }
      if (lowerEmail === 'grounding@gmail.com') setMaintenanceName('Grounding');
      if (lowerEmail === 'ldb/rdb@gmail.com') setMaintenanceName('LDB/RDB');
      if (lowerEmail === 'busduct@gmail.com') setMaintenanceName('Busduct');
      if (lowerEmail === 'lightingsystem@gmail.com') setMaintenanceName('Lighting System');
      if (lowerEmail === 'coolingtower@gmail.com') setMaintenanceName('Cooling Tower');
      if (lowerEmail === 'acsplit@gmail.com') setMaintenanceName('AC Split');
      if (lowerEmail === 'crac@gmail.com') setMaintenanceName('CRAC');
      if (lowerEmail === 'wld@gmail.com') setMaintenanceName('WLD');
    }

    if (template) {
      setCards(template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    }
  }, [user?.email, editingData]);

  useEffect(() => {
    if (editingData || user?.email?.toLowerCase() !== 'vrv@gmail.com') return;

    const isOutdoor = specificDetail.toLowerCase() === 'outdoor';
    const template = isOutdoor ? VRV_TEMPLATE.outdoor : VRV_TEMPLATE.indoor;

    if (template) {
      setCards(template.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    }
  }, [specificDetail, user?.email, editingData]);

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
    if (editingData || !user?.email) return;

    const saveDraft = () => {
      const draft = {
        userEmail: user.email,
        maintenanceName,
        maintenanceTime,
        specificDetail,
        vrvUnitDetail,
        companyType,
        cards: cards.map(c => ({
          id: c.id,
          description: c.description,
          photoBase64: c.photoBase64
        })),
        timestamp: new Date().getTime()
      };

      try {
        localStorage.setItem('report_form_draft', JSON.stringify(draft));
      } catch (err) {

        if (err instanceof Error && err.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, draft might be incomplete');
        }
      }
    };

    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [maintenanceName, maintenanceTime, specificDetail, vrvUnitDetail, companyType, cards, user?.email, editingData]);

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

  const generatePDFDocument = async () => {
    const logoLeftB64 = await loadLogoBase64(companyType === 'bri' ? logoBRILeft : logoDwimitra);
    const logoRightB64 = await loadLogoBase64(companyType === 'bri' ? logoBRI : logoNeutraDC);

    return await generateReportPDF({
      maintenanceName,
      maintenanceTime,
      specificDetail,
      vrvUnitDetail,
      cards,
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

  const saveReportToFirestore = async (pdfData?: { doc: jsPDF, fileName: string, filled: PhotoCard[] }) => {
    if (!maintenanceName || !maintenanceTime) return toast.error('Isi nama & waktu'), null;

    const finalSpecificDetail = (user?.email === 'vrv@gmail.com' && vrvUnitDetail)
      ? `${specificDetail.toUpperCase()} - ${vrvUnitDetail.toUpperCase()}`
      : specificDetail;

    const cardsToSave = pdfData ? pdfData.filled : cards.filter(c => c.photoBase64 || c.description);
    if (!cardsToSave.length) return toast.error('Minimal 1 card filled'), null;

    const toastId = toast.loading(editingData ? 'Updating report...' : 'Saving report...');
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

      if (apiUrl && !editingData) {
        const photos = cardsToSave.map((card, i) => ({
          index: i + 1,
          photoBase64: card.photoBase64 || '',
          description: card.description || '',
          hasPhoto: !!card.photoBase64
        }));

        const docIdFromAPI = await saveReportViaAPI(apiUrl, collectionName, reportData, photos);
        if (docIdFromAPI) {
          toast.success('Laporan disimpan (via API)', { id: toastId });
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

      toast.success(editingData ? 'Laporan diperbarui' : 'Laporan disimpan', { id: toastId });

      if (!editingData) {
        localStorage.removeItem('report_form_draft');
      }

      return docId;
    } catch (error) {
      console.error('Firestore save error:', error);
      toast.error('Gagal simpan', { id: toastId });
      return null;
    }
  };

  const handlePreviewPDF = () => {
    if (!maintenanceName || !maintenanceTime) return toast.error('Isi nama & waktu');
    if (!cards.some(c => c.photoBase64 || c.description)) return toast.error('Minimal 1 card filled');

    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    const result = await generatePDFDocument();
    if (result) {
      const { doc, fileName } = result;
      doc.save(fileName);
      await saveReportToFirestore(result);
    }
  };

  const handleManualSave = async () => {
    await saveReportToFirestore();
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Nama Maintenance</label>
                  <input
                    type="text"
                    value={maintenanceName}
                    onChange={e => setMaintenanceName(e.target.value)}
                    disabled={user?.email === 'lv@gmail.com' || user?.email === 'ats@gmail.com' || user?.email === 'grounding@gmail.com' || user?.email === 'ldb/rdb@gmail.com' || user?.email === 'trafo@gmail.com' || user?.email === 'busduct@gmail.com'}
                    className={`w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 ${(user?.email === 'lv@gmail.com' || user?.email === 'ats@gmail.com' || user?.email === 'grounding@gmail.com' || user?.email === 'ldb/rdb@gmail.com' || user?.email === 'trafo@gmail.com' || user?.email === 'busduct@gmail.com') ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder="cth. Maintenance FCU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Unit/Ruangan (Opsional)</label>
                  {user?.email === 'vrv@gmail.com' ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative group/select flex-1">
                        <select
                          value={specificDetail}
                          onChange={e => setSpecificDetail(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-10 transition-all hover:border-slate-500"
                        >
                          <option value="">Pilih Tipe Unit</option>
                          <option value="outdoor">Outdoor</option>
                          <option value="indoor">Indoor</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 group-focus-within/select:text-blue-500 transition-colors">
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="flex-[1.5]">
                        <input
                          type="text"
                          value={vrvUnitDetail}
                          onChange={e => setVrvUnitDetail(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="cth. Lantai 2 / Ruang Panel"
                        />
                      </div>
                    </div>
                  ) : (
                    <input type="text" value={specificDetail} onChange={e => setSpecificDetail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="cth. Unit 102" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Waktu Maintenance</label>
                  <input type="date" value={maintenanceTime} onChange={e => setMaintenanceTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Situs / Proyek</label>
                  <div className="relative group/select">
                    <select
                      value={companyType}
                      onChange={e => setCompanyType(e.target.value as 'neutra' | 'bri')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-10 transition-all hover:border-slate-500"
                    >
                      <option value="neutra">NeutraDC</option>
                      <option value="bri">Bank BRI</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 group-focus-within/select:text-blue-500 transition-colors">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
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
                <div key={card.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 relative group transition-all hover:border-blue-500/30">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Doc #{idx + 1}</span>
                    <button onClick={() => removeCard(card.id)} className="text-slate-500 hover:text-red-400 transition" title="Hapus Card"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="aspect-video bg-slate-900 rounded-lg mb-4 overflow-hidden relative border border-slate-700/50">
                    {card.photoBase64 ? (
                      <>
                        <img src={card.photoBase64} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingCardId(card.id)} className="p-2.5 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition shadow-xl" title="Edit/Crop"><Scissors className="w-4 h-4 text-white" /></button>
                          <button onClick={() => handlePhotoChange(card.id, null)} className="p-2.5 bg-red-600/20 backdrop-blur-md rounded-lg hover:bg-red-600/30 transition shadow-xl" title="Hapus Foto"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/80 transition group/upload">
                        <Camera className="w-8 h-8 text-slate-700 group-hover/upload:text-blue-500 transition-colors" />
                        <span className="text-[10px] text-slate-600 font-bold uppercase mt-2 group-hover/upload:text-slate-400">Unggah Foto</span>
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                  <textarea value={card.description} onChange={e => handleDescriptionChange(card.id, e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-700" rows={2} placeholder="Masukkan deskripsi dokumentasi..." />
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-12 justify-center">
              <button onClick={handlePreviewPDF} className="px-8 py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-3 border border-slate-700 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                <Eye className="w-6 h-6" /> PRATINJAU
              </button>
              <button onClick={handleManualSave} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition border-b-4 border-blue-800 active:border-b-0 active:translate-y-1">
                <Save className="w-6 h-6" /> {editingData ? 'PERBARUI PERUBAHAN' : 'SIMPAN KE ARSIP'}
              </button>
              <button onClick={handleExportPDF} className="px-8 py-4 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 hover:bg-red-700 transition border-b-4 border-red-800 active:border-b-0 active:translate-y-1">
                <FileType className="w-6 h-6" /> EKSPOR KE PDF
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
            onExport={handleExportPDF}
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}