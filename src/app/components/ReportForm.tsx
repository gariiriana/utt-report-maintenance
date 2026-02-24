import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Upload, Camera, FileType, Scissors, Eye, RefreshCw, ChevronDown } from 'lucide-react';
import { ExcelDocument } from './DocumentList';
import { ImageEditor } from './ImageEditor';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import logoDwimitra from '@/assets/logo_dwimitra.png';
import logoNeutraDC from '@/assets/005ac597864c02a96c9add5c6e054d23b8cfafbe.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';

import { jsPDF } from 'jspdf';
import { compressImage } from '@/lib/imageCompression';
import { PreviewReport } from './PreviewReport';

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

  // Sync with authCompanyType once on load
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

    if (lowerEmail === 'fcu@gmail.com') {
      const fcuTemplate = [
        'R-S', 'R-T', 'S-T', 'R-N', 'S-N', 'T-N',
        'Current R', 'Current S', 'Current T',
        'Checking Vibration', 'Checking Air Flow', 'Checking Humidity',
        'Checking Noise', 'Pressure Supply', 'Pressure Return',
        'Checking Temperature', 'Cleaning Filter', 'Cleaning evaporator'
      ];
      setCards(fcuTemplate.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    } else if (lowerEmail.includes('dock') || lowerEmail.includes('leveler')) {
      const dockTemplate = [
        'Pengecekan Hidrolik', 'Pengecekan Platform/Deck', 'Pengecekan Lip Plate',
        'Pelumasan Moving Parts', 'Pengecekan Safety Features', 'Test Operasional'
      ];
      setCards(dockTemplate.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    } else if (lowerEmail === 'pdu@gmail.com') {
      const pduTemplate = [
        'Name Plate', 'Measurement Temp Monitoring ISO-TRANS', 'Cleaning Panels menggunakan vacuum cleaner',
        'Measurement Panel', 'Pengecekan Digital Power Meter (KW)', 'Pengecekan Digital Power Meter (Volt)',
        'Pengecekan Digital Power Meter (Volt)', 'Pengecekan Digital Power Meter (Ampere)', 'Measurement Noise',
        'Measurement Voltage R-S', 'Measurement Voltage S-T', 'Measurement Voltage T-R', 'Measurement Voltage R-N',
        'Measurement Voltage S-N', 'Measurement Voltage T-N', 'Measurement Grounding', 'Measurement Ampere (R)',
        'Measurement Ampere (S)', 'Measurement Ampere (T)', 'Measurement Ampere (N)'
      ];
      setCards(pduTemplate.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    } else if (lowerEmail === 'acsplit@gmail.com') {
      const acSplitTemplate = [
        'Condition unit', 'Cleaning evaporator', 'Vacum draine AC', 'Cleaning Filter',
        'Measurement Voltage', 'Measurement ampere', 'Cleaning fan outdoor', 'Cleaning Filter',
        'Measurement pressure freon'
      ];
      setCards(acSplitTemplate.map((desc, idx) => ({ id: `${idx + 1}`, photo: null, description: desc })));
    }
  }, [user?.email, editingData]);

  useEffect(() => {
    if (editingData) {
      setMaintenanceName(editingData.maintenanceName);
      setMaintenanceTime(editingData.maintenanceTime);
      setSpecificDetail(editingData.specificDetail || '');
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
    if (!maintenanceName || !maintenanceTime) return toast.error('Isi nama & waktu'), null;
    const filled = cards.filter(c => c.photoBase64 || c.description);
    if (!filled.length) return toast.error('Minimal 1 card filled'), null;

    const formattedDate = new Date(maintenanceTime).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Load logos - Vite imports images as objects { src, height, width } so we extract .src
    const loadLogo = async (pathOrObj: string | { src: string }) => {
      try {
        const url = typeof pathOrObj === 'string' ? pathOrObj : pathOrObj.src;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Logo load error", e);
        return "";
      }
    };

    const logoLeftB64 = await loadLogo(companyType === 'bri' ? logoBRILeft : logoDwimitra);
    const logoRightB64 = await loadLogo(companyType === 'bri' ? logoBRI : logoNeutraDC);

    // Sequential Optimization - safer for mobile memory
    const { compressBase64Image } = await import('@/lib/imageCompression');
    const optimizedCards: PhotoCard[] = [];

    for (let i = 0; i < filled.length; i++) {
      const c = filled[i];
      if (c.photoBase64) {
        toast.loading(`Optimizing photo ${i + 1}/${filled.length}...`, { id: 'export' });
        try {
          // Ensuring aggressive shrinking
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          optimizedCards.push({ ...c, photoBase64: compressed });
        } catch (err) {
          console.error(`Fail at photo ${i}`, err);
          optimizedCards.push(c);
        }
      } else {
        optimizedCards.push(c);
      }
    }

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const usableWidth = pageWidth - 2 * margin;

    const isPDU = user?.email === 'pdu@gmail.com';
    const cols = isPDU ? 4 : 3;
    const perPage = isPDU ? 20 : 9;
    const photoH = isPDU ? 38 : 55;
    const capH = isPDU ? 10 : 12;

    const drawHeader = (doc: any) => {
      const isDwimitra = companyType !== 'bri';
      const logoH = isPDU ? 10 : 25;

      // Left Logo (Dwimitra / BRI Left)
      const leftW = isPDU ? 25 : (isDwimitra ? 25 : 35);
      const leftH = isPDU ? 10 : (isDwimitra ? logoH : 14);
      const leftY = 8;

      if (logoLeftB64) {
        doc.addImage(`data:image/png;base64,${logoLeftB64}`, 'PNG', margin, leftY, leftW, leftH);
      }

      // Right Logo (NeutraDC / BRI)
      const rightW = isPDU ? 25 : 35;
      const rightH = isPDU ? 10 : 14;
      const rightY = 15;
      if (logoRightB64) {
        doc.addImage(`data:image/png;base64,${logoRightB64}`, 'PNG', pageWidth - margin - rightW, rightY, rightW, rightH);
      }

      // Calculate Header Text Area (Center part between logos)
      const textAreaPadding = 3;
      const textAreaWidth = pageWidth - (2 * margin) - leftW - rightW - (2 * textAreaPadding);
      const textCenterX = margin + leftW + textAreaPadding + (textAreaWidth / 2);

      // --- Title: UPPERCASE, BOLD ---
      doc.setFontSize(isPDU ? 9 : 13).setFont('helvetica', 'bold');
      const titleText = `DOKUMENTASI PM ${maintenanceName.toUpperCase()}`;
      const splitTitle = doc.splitTextToSize(titleText, textAreaWidth);
      doc.text(splitTitle, textCenterX, 16, { align: 'center' });

      const titleLineH = isPDU ? 5 : 6;
      let nextY = 16 + splitTitle.length * titleLineH;

      // --- Date: smaller, normal weight ---
      const longDate = new Date(maintenanceTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.setFontSize(isPDU ? 8 : 11).setFont('helvetica', 'normal');
      doc.text(`(${longDate})`, textCenterX, nextY + 2, { align: 'center' });
      nextY += isPDU ? 6 : 8;

      // --- Specific Detail: uppercase, bold, bigger ---
      if (specificDetail) {
        doc.setFontSize(isPDU ? 7 : 10).setFont('helvetica', 'bold');
        const splitDetail = doc.splitTextToSize(specificDetail.toUpperCase(), textAreaWidth);
        doc.text(splitDetail, textCenterX, nextY + 2, { align: 'center' });
        nextY += splitDetail.length * (isPDU ? 4 : 5) + 2;
      }

      return Math.max(nextY + 6, 42);
    };

    let curY = drawHeader(doc);
    let count = 0;

    for (let i = 0; i < optimizedCards.length; i += cols) {
      if (count > 0 && count % perPage === 0) { doc.addPage(); curY = drawHeader(doc); }
      const row = optimizedCards.slice(i, i + cols);
      for (let j = 0; j < row.length; j++) {
        const x = margin + j * (usableWidth / cols);
        doc.rect(x, curY, usableWidth / cols - 2, photoH);
        const b64 = row[j].photoBase64;
        if (b64) doc.addImage(b64, 'JPEG', x + 1, curY + 1, usableWidth / cols - 4, photoH - 2);
        doc.rect(x, curY + photoH, usableWidth / cols - 2, capH);
        doc.setFontSize(isPDU ? 7 : 8).setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(row[j].description || '', usableWidth / cols - 6), x + (usableWidth / cols) / 2 - 1, curY + photoH + 5, { align: 'center' });
        count++;
      }
      curY += photoH + capH + 5;
    }
    const safeName = maintenanceName.replace(/[/\\?%*:|"<>]/g, '-');
    const safeDate = formattedDate.replace(/\//g, '-');
    return { doc, fileName: `Report_${safeName}_${safeDate}.pdf`, filled: optimizedCards };
  };

  const handlePreviewPDF = () => {
    if (!maintenanceName || !maintenanceTime) return toast.error('Isi nama & waktu');
    if (!cards.some(c => c.photoBase64 || c.description)) return toast.error('Minimal 1 card filled');
    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    try {
      toast.loading('Exporting...', { id: 'export' });
      const result = await generatePDFDocument();
      if (!result) return toast.dismiss('export');
      const { doc, fileName, filled } = result;
      doc.save(fileName);
      toast.success('Download started', { id: 'export' });

      const photosWithImage = filled.filter(c => c.photoBase64).length;
      const docRef = await addDoc(collection(db, 'pdf_documents'), {
        fileName, maintenanceName, maintenanceTime, specificDetail,
        createdBy: user?.email, createdAt: serverTimestamp(),
        totalPhotos: filled.length,
        photosWithImage,
        fileSize: doc.output('arraybuffer').byteLength,
      });

      // Sequential save with detailed feedback and size guard
      for (let i = 0; i < filled.length; i++) {
        const card = filled[i];
        if (card.photoBase64) {
          // Check for Firestore 1MB limit (1,048,576 bytes)
          // Base64 is roughly 33% larger than binary, so ~1.37MB base64 string
          const sizeInBytes = (card.photoBase64.length * 3) / 4;
          if (sizeInBytes > 1000000) {
            console.warn(`Photo ${i + 1} too large for Firestore (${Math.round(sizeInBytes / 1024)}KB).`);
            toast.error(`Foto ${i + 1} terlalu besar (>1MB). Mengabaikan simpan ke DB untuk foto ini.`, { id: 'export' });
            continue;
          }

          toast.loading(`Menyimpan foto ${i + 1} dari ${filled.length}...`, { id: 'export' });
          try {
            await addDoc(collection(db, `pdf_documents/${docRef.id}/photos`), {
              index: i + 1,
              photoBase64: card.photoBase64,
              description: card.description || '',
              hasPhoto: true
            });
          } catch (fireError) {
            console.error(`Error saving photo ${i + 1}:`, fireError);
            toast.error(`Gagal menyimpan foto ${i + 1}. Melanjutkan...`, { id: 'export' });
          }
        }
      }

      toast.success('Laporan berhasil disimpan ke database', { id: 'export' });
    } catch (e) {
      console.error('Export error details:', e);
      toast.error('Gagal export atau simpan. Silakan download PDF secara lokal.', { id: 'export' });
    }
  };

  const uploadedCount = cards.filter(c => c.photoBase64).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
      <AnimatePresence mode="wait">
        {!showPreview ? (
          <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {/* Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 min-w-[120px]">
                  <p className="text-xs text-slate-500 uppercase font-bold">Photos</p>
                  <p className="text-xl font-bold text-white">{uploadedCount} / {cards.length}</p>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 min-w-[120px]">
                  <p className="text-xs text-slate-500 uppercase font-bold">Template</p>
                  <p className="text-xl font-bold text-blue-400 uppercase">{companyType}</p>
                </div>
              </div>
              {editingData && (
                <button onClick={onClearEdit} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 text-sm font-bold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              )}
            </div>

            {/* Form */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 mb-6 font-geist">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Maintenance Name</label>
                  <input type="text" value={maintenanceName} onChange={e => setMaintenanceName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. FCU Maintenance" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Unit/Room (Optional)</label>
                  <input type="text" value={specificDetail} onChange={e => setSpecificDetail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Unit 102" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Maintenance Time</label>
                  <input type="date" value={maintenanceTime} onChange={e => setMaintenanceTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Site / Project</label>
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button onClick={() => document.getElementById('bulk')?.click()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                <Upload className="w-5 h-5" /> Bulk Upload Photos
              </button>
              <input id="bulk" type="file" multiple accept="image/*" className="hidden" onChange={handleBulkPhotoUpload} />
              <button onClick={() => setAddCardModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                <Plus className="w-5 h-5" /> Add Manual Card
              </button>
            </div>

            {/* Cards Grid */}
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
                        <span className="text-[10px] text-slate-600 font-bold uppercase mt-2 group-hover/upload:text-slate-400">Upload Photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoChange(card.id, e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                  <textarea value={card.description} onChange={e => handleDescriptionChange(card.id, e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-700" rows={2} placeholder="Enter documentation description..." />
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-12 justify-center">
              <button onClick={handlePreviewPDF} className="px-10 py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-3 border border-slate-700 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                <Eye className="w-6 h-6" /> PREVIEW REPORT
              </button>
              <button onClick={handleExportPDF} className="px-10 py-4 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 hover:bg-red-700 transition border-b-4 border-red-800 active:border-b-0 active:translate-y-1">
                <FileType className="w-6 h-6" /> EXPORT TO PDF
              </button>
            </div>
          </motion.div>
        ) : (
          <PreviewReport
            key="preview"
            maintenanceName={maintenanceName}
            maintenanceTime={maintenanceTime}
            specificDetail={specificDetail}
            cards={cards}
            companyType={companyType}
            userEmail={user?.email || ''}
            onBack={() => setShowPreview(false)}
            onExport={handleExportPDF}
          />
        )}
      </AnimatePresence>

      {/* Add Card Modal */}
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

      {/* Editor Modal */}
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