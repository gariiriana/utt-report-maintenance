import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Upload, Activity, Clock, Camera, FileText, Database, HardDrive, FileType, Scissors } from 'lucide-react';
import { ImageEditor } from './ImageEditor';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import logoDwimitra from '@/assets/a6129221f456afd6fd88d74c324473e495bdd7a8.png';
import logoNeutraDC from '@/assets/005ac597864c02a96c9add5c6e054d23b8cfafbe.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';

import { jsPDF } from 'jspdf';
import { compressImage, compressBase64Image } from '@/lib/imageCompression';

interface PhotoCard {
  id: string;
  photo: File | null;
  photoBase64?: string;
  description: string;
}

export function ReportForm() {
  const { user, companyType } = useAuth();
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');
  const [specificDetail, setSpecificDetail] = useState(''); // ✅ NEW: Untuk nama unit/ruangan
  const [cards, setCards] = useState<PhotoCard[]>([
    { id: '1', photo: null, description: '' },
    { id: '2', photo: null, description: '' },
    { id: '3', photo: null, description: '' },
    { id: '4', photo: null, description: '' },
    { id: '5', photo: null, description: '' },
    { id: '6', photo: null, description: '' },
  ]);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [numberOfCardsToAdd, setNumberOfCardsToAdd] = useState('1');

  // NOTE: The image compression is handled by the imported `compressImage` utility from '@/lib/imageCompression'.
  // The previous local implementation has been removed to avoid duplication and lint warnings.
  // All calls to `compressImage` now refer to the shared utility.

  // Auto-fill template descriptions based on USER EMAIL
  React.useEffect(() => {
    if (!user?.email) return;

    const lowerEmail = user.email.toLowerCase();

    // FCU Template - 15 items from screenshot
    if (lowerEmail.includes('fcu')) {
      const fcuTemplate = [
        'R-S',
        'R-T',
        'S-T',
        'R-N',
        'S-N',
        'T-N',
        'Current R',
        'Current S',
        'Current T',
        'Checking Vibration',
        'Checking Air Flow & Temperature',
        'Checking Humidity',
        'Checking Alarm',
        'Pressure Supply',
        'Pressure Return'
      ];

      // Create 15 cards for FCU
      const newCards = fcuTemplate.map((desc, idx) => ({
        id: `${idx + 1}`,
        photo: null,
        description: desc
      }));
      setCards(newCards);
    }
    // Dock Leveler Template
    else if (lowerEmail.includes('dock') || lowerEmail.includes('leveler')) {
      const dockTemplate = [
        'Pengecekan Hidrolik',
        'Pengecekan Platform/Deck',
        'Pengecekan Lip Plate',
        'Pelumasan Moving Parts',
        'Pengecekan Safety Features',
        'Test Operasional'
      ];

      // Create 6 cards for Dock Leveler
      const newCards = dockTemplate.map((desc, idx) => ({
        id: `${idx + 1}`,
        photo: null,
        description: desc
      }));
      setCards(newCards);
    }
  }, [user?.email]);

  const handlePhotoChange = async (id: string, file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran foto maksimal 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar');
        return;
      }

      try {
        toast.loading('Processing image...', { id: `compress-${id}` });
        const base64 = await compressImage(file);
        const compressedSizeKB = Math.round((base64.length * 0.75) / 1024);

        setCards(cards.map(card =>
          card.id === id ? { ...card, photo: file, photoBase64: base64 } : card
        ));

        toast.success(`Foto dimuat (${compressedSizeKB}KB)`, { id: `compress-${id}` });
      } catch (error) {
        toast.error('Gagal memuat foto', { id: `compress-${id}` });
      }
    } else {
      setCards(cards.map(card =>
        card.id === id ? { ...card, photo: null, photoBase64: undefined } : card
      ));
    }
  };

  const handleBulkPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newCards = [...cards];
    let fileIndex = 0;

    // Toast for progress
    const toastId = toast.loading(`Processing ${files.length} photos...`);

    try {
      // Loop through all existing cards first to fill empty slots
      for (let i = 0; i < newCards.length; i++) {
        if (fileIndex >= files.length) break;

        // If card is empty, fill it
        if (!newCards[i].photo) {
          const file = files[fileIndex];

          if (file.size > 5 * 1024 * 1024) {
            toast.error(`File ${file.name} too large (skip)`, { id: toastId });
            fileIndex++;
            i--; // Retry this slot
            continue;
          }

          const base64 = await compressImage(file);
          newCards[i] = {
            ...newCards[i],
            photo: file,
            photoBase64: base64
          };
          fileIndex++;
        }
      }

      // If there are still files left, create new cards
      while (fileIndex < files.length) {
        const file = files[fileIndex];
        // Validate size
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File ${file.name} too large (skip)`, { id: toastId });
          fileIndex++;
          continue;
        }

        const base64 = await compressImage(file);
        const newId = (Math.max(...newCards.map(c => parseInt(c.id))) + 1).toString();

        newCards.push({
          id: newId,
          photo: file,
          photoBase64: base64,
          description: ''
        });

        fileIndex++;
      }

      setCards(newCards);
      toast.success(`Successfully added ${fileIndex} photos`, { id: toastId });

      // Reset input
      e.target.value = '';
    } catch (error) {
      console.error(error);
      toast.error('Failed to process some photos', { id: toastId });
    }
  };

  const handleApplyEdit = (id: string, editedBase64: string) => {
    setCards(cards.map(card =>
      card.id === id ? { ...card, photoBase64: editedBase64 } : card
    ));
    setEditingCardId(null);
    toast.success('Photo updated');
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setCards(cards.map(card =>
      card.id === id ? { ...card, description } : card
    ));
  };

  const addCard = () => {
    setAddCardModalOpen(true);
  };

  const confirmAddCards = () => {
    const count = parseInt(numberOfCardsToAdd);
    if (isNaN(count) || count < 1 || count > 50) {
      toast.error('Jumlah card harus antara 1-50');
      return;
    }

    const startId = Math.max(...cards.map(c => parseInt(c.id))) + 1;
    const newCards = Array.from({ length: count }, (_, idx) => ({
      id: (startId + idx).toString(),
      photo: null,
      description: ''
    }));

    setCards([...cards, ...newCards]);
    toast.success(`${count} card berhasil ditambahkan`);
    setAddCardModalOpen(false);
    setNumberOfCardsToAdd('1');
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(card => card.id !== id));
    } else {
      toast.error('Minimal harus ada 1 card');
    }
  };



  const handleExportPDF = async () => {
    if (!maintenanceName || !maintenanceTime) {
      toast.error('Mohon isi nama maintenance dan waktu');
      return;
    }

    const filledCards = cards.filter(card => card.photoBase64 || card.description);
    if (filledCards.length === 0) {
      toast.error('Mohon isi minimal 1 card (foto atau deskripsi)');
      return;
    }

    try {
      toast.loading('Generating PDF...', { id: 'export-pdf' });

      // Format date
      const formattedDate = new Date(maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Create PDF (A4 portrait: 210mm x 297mm)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Margins
      const marginTop = 15;
      const marginLeft = 10;
      const marginRight = 10;
      const usableWidth = pageWidth - marginLeft - marginRight;

      let currentY = marginTop;

      // Load logos
      let logoLeftBase64 = '';
      let logoRightBase64 = '';

      try {
        // Select left logo based on company type
        const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
        const logoLeftResponse = await fetch(leftLogo);
        const logoLeftBlob = await logoLeftResponse.blob();
        const logoLeftArrayBuffer = await logoLeftBlob.arrayBuffer();
        logoLeftBase64 = btoa(
          new Uint8Array(logoLeftArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        // Select right logo based on company type
        const rightLogo = companyType === 'bri' ? logoBRI : logoNeutraDC;
        const logoRightResponse = await fetch(rightLogo);
        const logoRightBlob = await logoRightResponse.blob();
        const logoRightArrayBuffer = await logoRightBlob.arrayBuffer();
        logoRightBase64 = btoa(
          new Uint8Array(logoRightArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );
      } catch (error) {
        console.error('Failed to load logos:', error);
        toast.error('Failed to load logos', { id: 'export-pdf' });
        return;
      }

      // ✅ Helper function to add page header (logos + title + info)
      const addPageHeader = () => {
        let headerY = marginTop;

        // Add logos
        const logoWidth = 35;
        const logoHeight = 14;

        // Logo Left (Dwimitra or BRI Specific based on companyType)
        doc.addImage(
          `data:image/png;base64,${logoLeftBase64}`,
          'PNG',
          marginLeft,
          headerY,
          logoWidth,
          logoHeight
        );

        // Logo Right (NeutraDC or BRI based on companyType)
        doc.addImage(
          `data:image/png;base64,${logoRightBase64}`,
          'PNG',
          pageWidth - marginRight - logoWidth,
          headerY,
          logoWidth,
          logoHeight
        );

        headerY += logoHeight + 5;

        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const titleText = `Dokumentasi PM ${maintenanceName} (${formattedDate})`;
        const titleWidth = doc.getTextWidth(titleText);
        doc.text(titleText, (pageWidth - titleWidth) / 2, headerY);

        headerY += 8;

        // Specific Detail / Equipment Name
        if (specificDetail) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          const equipmentText = specificDetail;
          const equipmentWidth = doc.getTextWidth(equipmentText);
          doc.text(equipmentText, (pageWidth - equipmentWidth) / 2, headerY);
          headerY += 10;
        } else {
          headerY += 5;
        }

        return headerY; // Return Y position after header
      };

      // ✅ Add header for first page
      currentY = addPageHeader();

      // Add photos in 3-column grid
      const photoWidth = (usableWidth - 8) / 3; // 3 columns with 4mm spacing between
      const photoHeight = 55; // Fixed height for photos
      const captionHeight = 12; // Height for caption area
      const spacing = 4;
      const photosPerPage = 9; // 3x3 grid
      let photoCount = 0;

      for (let i = 0; i < filledCards.length; i += 3) {
        // ✅ Check if we need a new page (after every 9 photos)
        if (photoCount > 0 && photoCount % photosPerPage === 0) {
          doc.addPage();
          currentY = addPageHeader(); // ✅ Add header to new page!
        }

        const rowCards = filledCards.slice(i, i + 3);

        for (let j = 0; j < rowCards.length; j++) {
          const card = rowCards[j];
          const xPos = marginLeft + j * (photoWidth + spacing);

          // Draw photo border/box
          doc.setDrawColor(0);
          doc.setLineWidth(0.5);
          doc.rect(xPos, currentY, photoWidth, photoHeight);

          // Add photo if exists
          if (card.photoBase64) {
            try {
              // Compress photo before adding to PDF to reduce file size
              const compressedPhoto = await compressBase64Image(card.photoBase64, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.8
              });

              doc.addImage(
                compressedPhoto,
                'JPEG',
                xPos + 0.5,
                currentY + 0.5,
                photoWidth - 1,
                photoHeight - 1
              );
            } catch (imgError) {
              console.error('Failed to add image:', imgError);
            }
          }

          // Add caption box
          doc.rect(xPos, currentY + photoHeight, photoWidth, captionHeight);

          // Add caption text
          if (card.description) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(card.description, photoWidth - 4);
            const textY = currentY + photoHeight + 6;
            doc.text(lines, xPos + photoWidth / 2, textY, { align: 'center', maxWidth: photoWidth - 4 });
          }

          photoCount++;
        }

        currentY += photoHeight + captionHeight + 8; // Add spacing after each row
      }

      // Generate PDF and download
      const pdfBlob = doc.output('blob');
      const fileName = `Report_${maintenanceName.replace(/\s+/g, '_')}_${formattedDate.replace(/\//g, '-')}.pdf`;

      // Download file locally
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      // Show download success immediately
      toast.success('PDF downloaded successfully!', { id: 'export-pdf' });

      // Save metadata and photo data to Firestore using SUBCOLLECTION pattern (non-blocking)
      try {
        toast.loading('Saving to database...', { id: 'save-db' });

        // 1. Save main document with metadata only (no photos array)
        const docData: any = {
          fileName: fileName,
          maintenanceName: maintenanceName,
          maintenanceTime: maintenanceTime,
          createdAt: serverTimestamp(),
          createdBy: user?.email || 'Unknown',
          fileSize: pdfBlob.size,
          totalPhotos: filledCards.length,
          photosWithImage: filledCards.filter(c => c.photoBase64).length,
          // NO photosData array here! Photos will be in subcollection
        };

        // Add specificDetail only if it exists
        if (specificDetail) {
          docData.specificDetail = specificDetail;
        }

        // Add main document and get reference
        const docRef = await addDoc(collection(db, 'pdf_documents'), docData);

        // 2. Save each photo to subcollection: pdf_documents/{docId}/photos
        const photoSavePromises = filledCards.map(async (card, index) => {
          if (card.photoBase64) {
            try {
              // Compress photo for database storage
              const compressedPhoto = await compressBase64Image(card.photoBase64, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.7
              });

              // Save to subcollection
              await addDoc(collection(db, `pdf_documents/${docRef.id}/photos`), {
                index: index + 1,
                photoBase64: compressedPhoto,
                description: card.description || '',
                hasPhoto: true
              });
            } catch (err) {
              console.error(`Failed to save photo ${index + 1}:`, err);
            }
          }
        });

        // Wait for all photos to be saved
        await Promise.all(photoSavePromises);

        toast.success('Saved to database!', { id: 'save-db' });
      } catch (dbError) {
        console.error('Database save error:', dbError);
        toast.error('PDF downloaded but failed to save to database', { id: 'save-db' });
      }
    } catch (error) {
      console.error('Export PDF error:', error);
      toast.error('Failed to export PDF', { id: 'export-pdf' });
    }
  };

  const totalPhotoSize = cards.reduce((total, card) => {
    if (card.photo) {
      return total + card.photo.size;
    }
    return total;
  }, 0);

  const totalPhotoSizeMB = (totalPhotoSize / (1024 * 1024)).toFixed(2);

  const uploadedPhotos = cards.filter(c => c.photo).length;
  const filledCardsCount = cards.filter(card => card.photoBase64 || card.description).length;
  const completionPercentage = Math.round((uploadedPhotos / cards.length) * 100);
  const isReadyToExport = filledCardsCount > 0 && maintenanceName && maintenanceTime; // ✅ FIX: Based on actual export requirements

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">
      {/* System Stats */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-700/50">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">System Stats</h2>
            <p className="text-xs text-slate-500">Real-time maintenance metrics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <p className="text-xs text-slate-500 font-medium">Status</p>
            </div>
            <p className="text-sm sm:text-base font-semibold text-emerald-400">Active</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Photos</p>
            <p className="text-sm sm:text-base font-semibold text-white">{uploadedPhotos} / {cards.length}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">
            <p className="text-xs text-slate-500 font-medium mb-1">Completion</p>
            <p className="text-sm sm:text-base font-semibold text-blue-400">{completionPercentage}%</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">
            <p className="text-xs text-slate-500 font-medium mb-1">Ready to Export</p>
            <p className="text-sm sm:text-base font-semibold text-purple-400">{isReadyToExport ? 'Yes' : 'No'}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30 col-span-2 lg:col-span-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Size</p>
            <p className="text-sm sm:text-base font-semibold text-white">{totalPhotoSizeMB} MB</p>
          </div>
        </div>
      </div>

      {/* Maintenance Info */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-700/50">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-white">Maintenance Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Maintenance Name
            </label>
            <div className="relative group">
              <FileText className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-blue-400 transition" />
              <input
                type="text"
                value={maintenanceName}
                onChange={(e) => setMaintenanceName(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white placeholder-slate-500 text-sm sm:text-base"
                placeholder="e.g. Server Maintenance Q1 2026"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Maintenance Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={maintenanceTime}
                onChange={(e) => setMaintenanceTime(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white text-sm sm:text-base"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Specific Detail (Unit/Ruangan)
            </label>
            <div className="relative group">
              <FileText className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-blue-400 transition" />
              <input
                type="text"
                value={specificDetail}
                onChange={(e) => setSpecificDetail(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white placeholder-slate-500 text-sm sm:text-base"
                placeholder="e.g. Unit 101, Ruangan A"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Photo Documentation */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-slate-700/50">
        {/* Header - Always horizontal */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Photo Documentation</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Scissors className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Crop/Edit</span>
          </div>
        </div>

        {/* Buttons - Full width on mobile, side-by-side on desktop */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => document.getElementById('bulk-upload-input')?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium text-sm shadow-lg shadow-indigo-500/20 transition-all"
          >
            <HardDrive className="w-4 h-4" />
            <span>Bulk Upload</span>
          </motion.button>
          <input
            id="bulk-upload-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleBulkPhotoUpload}
          />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addCard}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium text-sm shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <AnimatePresence mode="popLayout">
            {cards.map((card, index) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-blue-500/30 transition relative group"
              >
                {/* Card Number */}
                <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg z-10 border border-blue-400/30">
                  {index + 1}
                </div>

                {cards.length > 1 && (
                  <button
                    onClick={() => removeCard(card.id)}
                    className="absolute -top-3 -right-3 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition z-10 shadow-lg"
                    title="Hapus Card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Photo {index + 1}
                    {card.photo && (
                      <span className="text-xs text-slate-500 ml-2">
                        ({(card.photo.size / 1024).toFixed(0)}KB)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    {card.photoBase64 ? (
                      <div className="relative group/image">
                        <img
                          src={card.photoBase64}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-44 object-cover rounded-lg border border-slate-700/50"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-100 transition rounded-lg flex items-center justify-center gap-3">
                          <button
                            onClick={() => setEditingCardId(card.id)}
                            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xl"
                            title="Edit / Crop Foto"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handlePhotoChange(card.id, null)}
                            className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-xl"
                            title="Hapus Foto"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-44 border border-dashed border-slate-700/50 rounded-lg cursor-pointer hover:border-blue-500/50 transition bg-slate-900/30 group/upload">
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-slate-600 mb-2 mx-auto group-hover/upload:text-blue-400 transition" />
                          <span className="text-sm text-slate-500 group-hover/upload:text-slate-400 transition">Upload Photo</span>
                          <span className="text-xs text-slate-600 block mt-1">PNG, JPG max 5MB</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoChange(card.id, file);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={card.description}
                    onChange={(e) => handleDescriptionChange(card.id, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition resize-none text-white placeholder-slate-600"
                    rows={3}
                    placeholder="Enter description..."
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold text-base sm:text-lg shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all"
          >
            <FileType className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Export to PDF</span>
          </motion.button>
        </div>
      </div>

      {/* Add Card Modal */}
      <AnimatePresence>
        {addCardModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setAddCardModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-4 text-center">Berapa Card yang Akan Ditambah?</h3>

              <input
                type="number"
                min="1"
                max="50"
                value={numberOfCardsToAdd}
                onChange={(e) => setNumberOfCardsToAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmAddCards();
                  }
                }}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-center text-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                placeholder="1-50"
                autoFocus
              />
              <p className="text-xs text-slate-500 text-center mb-6">Maksimal 50 card</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setAddCardModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
                >
                  Batal
                </button>
                <button
                  onClick={confirmAddCards}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Editor Modal */}
      <AnimatePresence>
        {editingCardId && (
          <ImageEditor
            image={cards.find(c => c.id === editingCardId)?.photoBase64 || ''}
            onSave={(editedBase64) => handleApplyEdit(editingCardId, editedBase64)}
            onCancel={() => setEditingCardId(null)}
          />
        )}
      </AnimatePresence>
    </div >
  );
}