import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Camera, Upload, Edit2, FileDown, FileText,
    CheckSquare, Square, User, MapPin, Users, Briefcase,
    Save, Loader2, ChevronDown, ChevronUp, ClipboardList, Trash2, ShieldCheck,
    Download, Archive, ArrowLeft, Eye, X
} from 'lucide-react';
import { toast } from 'sonner';
import { HSEPhotoEditor } from '@/components/HSEPhotoEditor';
import { generateHSEPdf, type HSEFormData } from '@/utils/HSEPdfExport';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, getDocs, deleteDoc, QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { ExcelDocument } from '@/components/DocumentList';
import { compressImage, compressBase64Image } from '@/utils/imageCompression';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import {
    INITIAL_HSE_CHECKLIST,
    HSE_CHECKLIST_LABELS,
    type HSEChecklist
} from '@/config/templates';
import { draftStorage } from '@/utils/draftStorage';

interface PhotoItem {
    id: string;
    dataUrl: string;
    description: string;
    label?: string;
    index?: number;
}

interface HSEReportFormProps {
    editingData?: ExcelDocument | null;
    onClearEdit?: () => void;
    mode?: 'inspection' | 'sio' | 'silo';
    readOnly?: boolean;
}

export function HSEReportForm({ editingData, onClearEdit, mode = 'inspection', readOnly = false }: HSEReportFormProps) {
    const { user, userRole } = useAuth();

    const [aktivitas, setAktivitas] = useState('');
    const [lokasi, setLokasi] = useState('');
    const [personil, setPersonil] = useState('');
    const [pic, setPic] = useState('');
    const [anggota, setAnggota] = useState('');
    const [inspectorK3, setInspectorK3] = useState('');
    const [maintenanceCategory, setMaintenanceCategory] = useState('');
    const [checklist, setChecklist] = useState<HSEChecklist>({ ...INITIAL_HSE_CHECKLIST });
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [checklistOpen, setChecklistOpen] = useState(true);

    const [sioOperatorName, setSioOperatorName] = useState('');
    const [sioNumber, setSioNumber] = useState('');
    const [sioExpiryDate, setSioExpiryDate] = useState('');
    const [sioPhotos, setSioPhotos] = useState<PhotoItem[]>([]);
    const [siloFile, setSiloFile] = useState<File | null>(null);
    const [siloPdfUrl, setSiloPdfUrl] = useState('');
    const [msdsFile, setMsdsFile] = useState<File | null>(null);
    const [msdsPdfUrl, setMsdsPdfUrl] = useState('');

    const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isExported, setIsExported] = useState(false);

    // Read-only, preview, and download states
    const [reportDate, setReportDate] = useState<string>('');
    const [previewModalPhoto, setPreviewModalPhoto] = useState<PhotoItem | null>(null);
    const [isDownloadingZip, setIsDownloadingZip] = useState(false);

    const isInitialMount = useRef(true);

    useEffect(() => {
        if (editingData && editingData.documentType === 'hse') {
            // Segera isi data foto dari photosData jika sudah disediakan oleh DocumentList
            if ((editingData as any).photosData && (editingData as any).photosData.length > 0) {
                const initialPhotos: PhotoItem[] = ((editingData as any).photosData || []).map((p: any, idx: number) => ({
                    id: p.id || `photo-${idx}`,
                    dataUrl: p.dataUrl || p.photoBase64 || p.base64 || p.url || '',
                    description: p.description || '',
                    label: p.label || '',
                    index: p.index ?? idx
                }));
                if (initialPhotos.length > 0) {
                    setPhotos(initialPhotos);
                }
            }

            const fetchFullData = async () => {
                const toastId = !readOnly ? toast.loading('Memuat data laporan...') : null;
                try {
                    const docSnap = await getDoc(doc(db, 'hse', editingData.id));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setAktivitas(data.aktivitas || '');
                        setLokasi(data.lokasi || '');
                        setPersonil(data.personil || '');
                        setPic(data.pic || '');
                        setAnggota(data.anggota || '');
                        setInspectorK3(data.inspectorK3 || '');
                        if (data.date) setReportDate(data.date);
                        if (data.maintenanceType && data.maintenanceType !== 'OTHER') {
                            setMaintenanceCategory(data.maintenanceType);
                        } else {
                            setMaintenanceCategory('');
                        }
                        if (data.checklist) setChecklist(data.checklist);
                        
                        if (data.sioData) {
                            setSioOperatorName(data.sioData.operatorName || '');
                            setSioNumber(data.sioData.sioNumber || '');
                            setSioExpiryDate(data.sioData.expiryDate || '');
                            if (data.sioData.photos) {
                                setSioPhotos(data.sioData.photos.map((p: any) => ({
                                    id: Math.random().toString(),
                                    dataUrl: p.base64 || p.dataUrl,
                                    label: p.label,
                                    description: p.description || ''
                                })));
                            }
                        }
                        if (data.siloPdfUrl) setSiloPdfUrl(data.siloPdfUrl);
                        if (data.msdsPdfUrl) setMsdsPdfUrl(data.msdsPdfUrl);

                        const photosSnap = await getDocs(collection(db, `hse/${editingData.id}/photos`));
                        const fetchedPhotos: PhotoItem[] = photosSnap.docs
                            .map((d: QueryDocumentSnapshot) => {
                                const photoData = d.data();
                                return {
                                    id: d.id,
                                    dataUrl: photoData.dataUrl || photoData.photoBase64 || photoData.base64,
                                    description: photoData.description || '',
                                    label: photoData.label || '',
                                    index: photoData.index || 0
                                };
                            })
                            .sort((a: any, b: any) => a.index - b.index);

                        if (fetchedPhotos.length > 0) {
                            setPhotos(fetchedPhotos);
                        }
                    }
                    if (toastId) toast.dismiss(toastId);
                } catch (err) {
                    console.error("Error fetching full HSE data:", err);
                    if (toastId) toast.error('Gagal memuat data lengkap', { id: toastId });
                }
            };
            fetchFullData();
        } else if (editingData) {
            setAktivitas(editingData.maintenanceName || '');
            setLokasi(editingData.specificDetail || '');
        }
    }, [editingData, user?.email, readOnly]);

    useEffect(() => {
        if (readOnly || editingData || !user?.email) {
            setIsDraftLoading(false);
            return;
        }

        const loadDraft = async () => {
            const saved = await draftStorage.get(`hse_draft_${mode}_${user.email}`);
            if (saved) {
                try {
                    setAktivitas(saved.aktivitas || '');
                    setLokasi(saved.lokasi || '');
                    setPersonil(saved.personil || '');
                    setPic(saved.pic || '');
                    setAnggota(saved.anggota || '');
                    setInspectorK3(saved.inspectorK3 || '');
                    if (saved.maintenanceCategory && saved.maintenanceCategory !== 'OTHER') {
                        setMaintenanceCategory(saved.maintenanceCategory);
                    } else {
                        setMaintenanceCategory('');
                    }
                    if (saved.checklist) setChecklist(saved.checklist);
                    if (saved.photos && saved.photos.length > 0) {
                        setPhotos(saved.photos);
                    }
                    if (saved.sioOperatorName) setSioOperatorName(saved.sioOperatorName);
                    if (saved.sioNumber) setSioNumber(saved.sioNumber);
                    if (saved.sioExpiryDate) setSioExpiryDate(saved.sioExpiryDate);
                    if (saved.sioPhotos) setSioPhotos(saved.sioPhotos);
                    if (saved.siloPdfUrl) setSiloPdfUrl(saved.siloPdfUrl);
                    if (saved.msdsPdfUrl) setMsdsPdfUrl(saved.msdsPdfUrl);
                    if (saved.msdsFile) setMsdsFile(saved.msdsFile);
                } catch (err) {
                    console.error('Failed to load HSE draft:', err);
                }
            }
            setIsDraftLoading(false);
        };
        loadDraft();
    }, [user?.email, editingData, mode, readOnly]);

    useEffect(() => {
        if (readOnly || editingData || !user?.email || isDraftLoading || isExporting || isExported) {
            if (isExported && user?.email && !editingData) {
                draftStorage.remove(`hse_draft_${mode}_${user.email}`);
            }
            return;
        }

        const saveDraft = async () => {
            const draft = {
                aktivitas,
                lokasi,
                personil,
                pic,
                anggota,
                inspectorK3,
                maintenanceCategory,
                checklist,
                photos: photos.map(p => ({
                    id: p.id,
                    dataUrl: p.dataUrl,
                    description: p.description,
                    label: p.label
                })),
                sioOperatorName,
                sioNumber,
                sioExpiryDate,
                sioPhotos: sioPhotos.map(p => ({
                    id: p.id,
                    dataUrl: p.dataUrl,
                    description: p.description,
                    label: p.label
                })),
                siloPdfUrl,
                msdsPdfUrl,
                msdsFile,
                timestamp: new Date().getTime()
            };
            try {
                await draftStorage.set(`hse_draft_${mode}_${user.email}`, draft);
            } catch (err) {
                console.error('Failed to save HSE draft:', err);
            }
        };

        const timeoutId = setTimeout(saveDraft, 2000);
        return () => clearTimeout(timeoutId);
    }, [
        aktivitas, lokasi, personil, pic, anggota, inspectorK3, maintenanceCategory, checklist, photos,
        sioOperatorName, sioNumber, sioExpiryDate, sioPhotos, siloPdfUrl, msdsPdfUrl, msdsFile,
        user?.email, editingData, isDraftLoading, isExporting, mode
    ]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // Reset export flags when user modifies any input field
        setIsExported(false);
        if (user?.email) {
            localStorage.removeItem(`exportedUtt_${mode}_${user.email}`);
            localStorage.removeItem(`exportedNeutra_${mode}_${user.email}`);
        }
    }, [
        aktivitas, lokasi, personil, pic, anggota, inspectorK3, maintenanceCategory, checklist, photos,
        sioOperatorName, sioNumber, sioExpiryDate, sioPhotos, siloFile, msdsFile, readOnly
    ]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sioLabelRef = useRef<string>('');

    const toggleCheck = (key: keyof HSEChecklist) => {
        if (readOnly) return;
        setChecklist(prev => {
            const next = { ...prev, [key]: !prev[key] };

            if (key === 'loto' && !next.loto) {
                next.lockOut = next.tagOut = false;
            }
            if (key === 'ppeKhusus' && !next.ppeKhusus) {
                next.bodyHarness = next.sarungTanganKaretHighVoltage = next.sarungTanganKaretChemical = next.apron = next.kedokLas = next.coverShoes = next.respirator = next.sarungTanganCutResistance = next.pelindungMata = false;
            }
            if (key === 'safetySign' && !next.safetySign) {
                next.pitaBaricade = next.safetyCone = next.stikBariket = next.underMaintenance = false;
            }
            if (key === 'dokumen' && !next.dokumen) {
                next.msds = false;
            }

            const lotoChildren = ['lockOut', 'tagOut'];
            if (lotoChildren.includes(key as string) && next[key as keyof HSEChecklist]) {
                next.loto = true;
            }
            const ppeChildren = ['bodyHarness', 'sarungTanganKaretHighVoltage', 'sarungTanganKaretChemical', 'apron', 'kedokLas', 'coverShoes', 'respirator', 'sarungTanganCutResistance', 'pelindungMata'];
            if (ppeChildren.includes(key as string) && next[key as keyof HSEChecklist]) {
                next.ppeKhusus = true;
            }
            const safetyChildren = ['pitaBaricade', 'safetyCone', 'stikBariket', 'underMaintenance'];
            if (safetyChildren.includes(key as string) && next[key as keyof HSEChecklist]) {
                next.safetySign = true;
            }
            if (key === 'msds' && next.msds) {
                next.dokumen = true;
            }

            return next;
        });

        if ((key === 'dokumen' && checklist.dokumen) || (key === 'msds' && checklist.msds)) {
            setMsdsFile(null);
            setMsdsPdfUrl('');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, label?: string) => {
        if (readOnly) return;
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const toastId = toast.loading(`Memproses 0/${files.length} foto...`);
        const newPhotos: PhotoItem[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;

                toast.loading(`Memproses ${i + 1}/${files.length} foto...`, { id: toastId });

                try {
                    const dataUrl = await compressImage(file);
                    newPhotos.push({
                        id: `${Date.now()}-${Math.random()}`,
                        dataUrl,
                        description: '',
                        label: label || sioLabelRef.current || ''
                    });
                } catch (err) {
                    console.error("Compression failed for", file.name, err);

                    const readerResult = await new Promise<string | null>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target?.result as string);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(file);
                    });

                    if (readerResult) {
                        newPhotos.push({
                            id: `${Date.now()}-${Math.random()}`,
                            dataUrl: readerResult,
                            description: '',
                            label: label || sioLabelRef.current || ''
                        });
                    }
                }
            }

            if (newPhotos.length > 0) {
                setPhotos(prev => [...prev, ...newPhotos]);
                toast.success(`${newPhotos.length} foto berhasil ditambahkan`, { id: toastId });
            } else {
                toast.error("Tidak ada foto valid yang berhasil diunggah", { id: toastId });
            }
        } catch (err) {
            console.error("Bulk upload error:", err);
            toast.error("Terjadi kesalahan saat mengunggah foto", { id: toastId });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            sioLabelRef.current = '';
        }
    };

    const removePhoto = (id: string) => {
        if (readOnly) return;
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveEdit = (editedDataUrl: string) => {
        if (readOnly || !editingPhoto) return;
        setPhotos(prev => prev.map(p =>
            p.id === editingPhoto.id ? { ...p, dataUrl: editedDataUrl } : p
        ));
        setEditingPhoto(null);
        toast.success('Foto berhasil diedit!');
    };

    // Fungsi unduh satu foto per satu foto (JPG)
    const downloadSinglePhoto = async (photo: PhotoItem, index: number) => {
        if (!photo.dataUrl) {
            toast.error('Data foto tidak valid');
            return;
        }
        try {
            const safeTitle = (aktivitas || 'foto_hse').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const desc = photo.description ? `_${photo.description.trim().slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
            const label = photo.label ? `_${photo.label.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
            const fileName = `${safeTitle}${label}_foto_${index + 1}${desc}.jpg`;

            if (photo.dataUrl.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = photo.dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // Fetch blob first to force download for remote URLs
                const res = await fetch(photo.dataUrl);
                const blob = await res.blob();
                saveAs(blob, fileName);
            }
            toast.success(`Foto #${index + 1} berhasil didownload`);
        } catch (err) {
            console.error('Download photo error:', err);
            const link = document.createElement('a');
            link.href = photo.dataUrl;
            link.download = `foto_${index + 1}.jpg`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Fungsi unduh seluruh foto evidence sekaligus ke dalam file ZIP
    const handleDownloadAllPhotosZip = async () => {
        if (photos.length === 0) {
            toast.error('Tidak ada foto untuk didownload');
            return;
        }
        setIsDownloadingZip(true);
        const toastId = toast.loading('Menyiapkan file ZIP foto...');
        try {
            const zip = new JSZip();
            const folderName = (aktivitas || 'foto_hse').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const imgFolder = zip.folder(folderName) || zip;

            for (let i = 0; i < photos.length; i++) {
                const p = photos[i];
                if (!p.dataUrl) continue;
                
                const desc = p.description ? `_${p.description.trim().slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
                const label = p.label ? `_${p.label.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
                const fileName = `foto_${i + 1}${label}${desc}.jpg`;

                if (p.dataUrl.startsWith('data:')) {
                    let base64Data = p.dataUrl;
                    if (base64Data.includes(',')) {
                        base64Data = base64Data.split(',')[1];
                    }
                    imgFolder.file(fileName, base64Data, { base64: true });
                } else {
                    const res = await fetch(p.dataUrl);
                    const blob = await res.blob();
                    imgFolder.file(fileName, blob);
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, `${folderName}_semua_foto.zip`);
            toast.success(`Berhasil mendownload ${photos.length} foto dalam ZIP`, { id: toastId });
        } catch (err) {
            console.error('Download all photos error:', err);
            toast.error('Gagal membuat file ZIP', { id: toastId });
        } finally {
            setIsDownloadingZip(false);
        }
    };

    const buildFormData = (): HSEFormData => {
        return {
            aktivitas,
            lokasi,
            personil,
            pic,
            anggota,
            inspectorK3: inspectorK3 || user?.email || '',
            checklist,
            photos: photos.map(p => ({
                base64: p.dataUrl,
                description: p.description,
                label: p.label
            })),
            date: reportDate || (editingData?.date as string) || new Date().toISOString(),
            hseType: mode as any,
            maintenanceType: maintenanceCategory,
            sioData: {
                operatorName: sioOperatorName,
                sioNumber: sioNumber,
                expiryDate: sioExpiryDate,
                photos: sioPhotos.map(p => ({
                    base64: p.dataUrl,
                    label: p.label,
                    description: p.description
                }))
            },
            siloFile: siloFile || undefined,
            siloPdfUrl: siloPdfUrl || undefined,
            msdsFile: (checklist.msds && msdsFile) ? msdsFile : undefined,
            msdsPdfUrl: (checklist.msds && msdsPdfUrl) ? msdsPdfUrl : undefined
        };
    };

    const handleSave = async (silent = false, reportType?: 'utt' | 'neutradc') => {
        if (readOnly) return null;
        if (!aktivitas.trim() && mode === 'inspection') {
            if (!silent) toast.error('Aktivitas wajib diisi');
            return null;
        }
        setIsSaving(true);
        const toastId = !silent ? toast.loading(editingData ? 'Memperbarui laporan...' : 'Menyimpan laporan...') : null;
        try {
            const formData = buildFormData();
            if (reportType) formData.reportType = reportType;

            let finalDocId = '';
            
            const optimizedSioPhotos = await Promise.all(sioPhotos.map(async (p) => {
                let dataUrl = p.dataUrl;
                try {
                    dataUrl = await compressBase64Image(p.dataUrl, { maxWidth: 600, quality: 0.4 });
                } catch (e) { console.error("SIO Compression failed", e); }
                return {
                    base64: dataUrl,
                    label: p.label || '',
                    description: p.description || ''
                };
            }));

            const resolvedReportType: 'utt' | 'neutradc' = reportType || (editingData?.documentType === 'hse' ? (editingData as any).reportType as 'utt' | 'neutradc' : 'utt');
            const reportData = {
                aktivitas: aktivitas || '',
                lokasi: lokasi || '',
                personil: personil || '',
                pic: pic || '',
                anggota: anggota || '',
                inspectorK3: inspectorK3 || user?.email || '',
                date: formData.date,
                authorEmail: (user?.email || '').toLowerCase(),
                updatedAt: serverTimestamp(),
                reportType: resolvedReportType,
                hseType: mode,
                maintenanceType: maintenanceCategory || 'OTHER',
                checklist,
                photos: [],
                sioData: {
                    operatorName: sioOperatorName || '',
                    sioNumber: sioNumber || '',
                    expiryDate: sioExpiryDate || '',
                    photos: optimizedSioPhotos
                },
            };

            if (editingData && editingData.documentType === 'hse') {
                finalDocId = editingData.id;
                await updateDoc(doc(db, 'hse', finalDocId), reportData);
                
                try {
                    const photosRef = collection(db, `hse/${finalDocId}/photos`);
                    const oldPhotos = await getDocs(photosRef);
                    if (!oldPhotos.empty) {
                        for (const pDoc of oldPhotos.docs) {
                            await deleteDoc(doc(db, `hse/${finalDocId}/photos`, pDoc.id)).catch(e => console.warn("Photo delete failed", e));
                        }
                    }
                } catch (e) {
                    console.warn("Could not clear old photos, continuing anyway", e);
                }
            } else {
                const docRef = await addDoc(collection(db, 'hse'), {
                    ...reportData,
                    createdAt: serverTimestamp(),
                });
                finalDocId = docRef.id;
            }

            if (photos.length > 0) {
                await Promise.all(photos.map(async (photo, index) => {
                    let dataUrl = photo.dataUrl;
                    const sizeInBytes = (dataUrl.length * 3) / 4;

                    if (sizeInBytes > 600 * 1024) {
                        try {
                            dataUrl = await compressBase64Image(dataUrl, { maxWidth: 800, quality: 0.5 });
                        } catch (err) {
                            console.error("HSE Compression failure", err);
                        }
                    }

                    await addDoc(collection(db, `hse/${finalDocId}/photos`), {
                        index: index + 1,
                        dataUrl: dataUrl,
                        description: photo.description || '',
                        label: photo.label || '',
                        createdAt: serverTimestamp(),
                    });
                }));
            }

            if (!silent && toastId) {
                const message = editingData ? 'Laporan HSE diperbarui!' : 'Laporan HSE tersimpan!';
                toast.success(message, { id: toastId });
            }
            if (onClearEdit) onClearEdit();
            return finalDocId;
        } catch (err) {
            console.error(err);
            if (!silent && toastId) {
                toast.error('Gagal menyimpan laporan', { id: toastId });
            }
            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = async (reportMode: 'utt' | 'neutradc' = 'neutradc') => {
        if (!aktivitas.trim() && mode === 'inspection') {
            toast.error('Aktivitas wajib diisi sebelum export PDF');
            return;
        }
        setIsExporting(true);
        setIsGeneratingPdf(true);
        const toastId = toast.loading(`Membuat PDF ${reportMode.toUpperCase()}...`);
        try {
            const formData = buildFormData();
            formData.reportType = reportMode;

            const shouldAutoOpen = userRole === 'hse' && user?.email?.toLowerCase() !== 'hsemamik@gmail.com';

            if (readOnly) {
                await generateHSEPdf(formData, shouldAutoOpen, userRole || undefined);
                toast.success(`PDF ${reportMode.toUpperCase()} berhasil dibuat!`, { id: toastId });
                return;
            }

            const [, savedDocId] = await Promise.all([
                generateHSEPdf(formData, shouldAutoOpen, userRole || undefined).catch((pdfErr) => {
                    console.error('PDF generation failed:', pdfErr);
                    throw new Error(`Gagal membuat PDF: ${(pdfErr as Error)?.message || 'Terjadi kesalahan'}`);
                }),
                handleSave(true, reportMode).catch((saveErr: any) => {
                    console.error('Save failed:', saveErr);
                    throw new Error(`Gagal menyimpan laporan: ${saveErr?.message || 'Permission ditolak. Pastikan akun Anda memiliki akses HSE.'}`);
                }),
            ]);

            if (!savedDocId) throw new Error('Gagal mendapatkan ID laporan setelah disimpan');

            // Track which report types have been exported
            const storedUttKey = `exportedUtt_${mode}_${user?.email}`;
            const storedNeutraKey = `exportedNeutra_${mode}_${user?.email}`;

            if (reportMode === 'utt') {
                if (user?.email) localStorage.setItem(storedUttKey, 'true');
            } else if (reportMode === 'neutradc') {
                if (user?.email) localStorage.setItem(storedNeutraKey, 'true');
            }

            const isUttExported = reportMode === 'utt' || (user?.email ? localStorage.getItem(storedUttKey) === 'true' : false);
            const isNeutraExported = reportMode === 'neutradc' || (user?.email ? localStorage.getItem(storedNeutraKey) === 'true' : false);

            const bothExported = isUttExported && isNeutraExported;

            if (bothExported && user?.email && !editingData) {
                // Clean up storage first
                await draftStorage.remove(`hse_draft_${mode}_${user.email}`).catch(console.error);
                localStorage.removeItem(storedUttKey);
                localStorage.removeItem(storedNeutraKey);
                
                // Use isInitialMount ref to prevent the input-change useEffect
                // from clearing export flags during the programmatic reset
                isInitialMount.current = true;
                
                // Reset all form state variables to empty/initial values
                setAktivitas('');
                setLokasi('');
                setPersonil('');
                setPic('');
                setAnggota('');
                setInspectorK3('');
                setMaintenanceCategory('');
                setChecklist({ ...INITIAL_HSE_CHECKLIST });
                setPhotos([]);
                setSioOperatorName('');
                setSioNumber('');
                setSioExpiryDate('');
                setSioPhotos([]);
                setSiloFile(null);
                setSiloPdfUrl('');
                setMsdsFile(null);
                setMsdsPdfUrl('');
                
                setIsExported(false);

                toast.success(`✅ Kedua PDF berhasil dibuat! Form siap untuk laporan baru.`, { id: toastId, duration: 4000 });
            } else {
                toast.success(`✅ PDF ${reportMode.toUpperCase()} berhasil dibuat & disimpan ke ISO!`, { id: toastId, duration: 4000 });
            }
        } catch (err) {
            console.error('Export Error:', err);
            toast.error((err as Error)?.message || 'Terjadi kesalahan saat export', { id: toastId, duration: 6000 });
        } finally {
            setIsGeneratingPdf(false);
            setIsExporting(false);
        }
    };

    const handleResetForm = () => {
        if (window.confirm("Apakah Anda yakin ingin mengosongkan semua data input laporan ini?")) {
            setAktivitas('');
            setLokasi('');
            setPersonil('');
            setPic('');
            setAnggota('');
            setInspectorK3('');
            setMaintenanceCategory('');
            setChecklist({ ...INITIAL_HSE_CHECKLIST });
            setPhotos([]);
            setSioOperatorName('');
            setSioNumber('');
            setSioExpiryDate('');
            setSioPhotos([]);
            setSiloFile(null);
            setSiloPdfUrl('');
            setMsdsFile(null);
            setMsdsPdfUrl('');
            
            if (user?.email) {
                draftStorage.remove(`hse_draft_${mode}_${user.email}`).catch(console.error);
            }
            setIsExported(false);
            toast.success("Formulir berhasil dikosongkan");
        }
    };

    return (
        <>
            <div className="space-y-6">
                {readOnly ? (
                    <div className="flex justify-between items-center bg-gradient-to-r from-amber-50 via-sky-50 to-emerald-50 p-4 rounded-2xl border border-amber-200/80 shadow-xs mb-2">
                        <div className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 flex-wrap">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                            <span>Mode: Pratinjau Dokumen HSE (Hanya Baca / Read-Only)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">Admin Mode</span>
                        </div>
                        {onClearEdit && (
                            <button 
                                type="button"
                                onClick={onClearEdit} 
                                className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4 text-slate-600" /> Kembali ke Arsip
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-4 rounded-2xl border border-emerald-100 shadow-sm mb-2">
                        <div className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Mode: {editingData ? 'Edit ' : 'Input '}{mode.toUpperCase()}
                        </div>
                        {editingData && (
                            <button onClick={onClearEdit} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold flex items-center gap-2 transition hover:bg-blue-100 shadow-sm cursor-pointer">
                                <ArrowLeft className="w-4 h-4" /> Batal Edit
                            </button>
                        )}
                    </div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                    <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <ClipboardList className="w-4 h-4 text-emerald-700" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">Informasi {mode.toUpperCase()}</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Inspector HSE
                                </span>
                            </label>
                            <input
                                type="text"
                                value={inspectorK3}
                                disabled={readOnly}
                                onChange={e => setInspectorK3(e.target.value)}
                                placeholder="Nama Inspector"
                                className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                    readOnly 
                                        ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                        : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                }`}
                            />
                        </div>

                        {mode !== 'inspection' && (
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Jenis Maintenance
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={maintenanceCategory}
                                    disabled={readOnly}
                                    onChange={e => setMaintenanceCategory(e.target.value.toUpperCase())}
                                    placeholder="Contoh: PJU, LIFT, GENSET, dll"
                                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition uppercase shadow-sm ${
                                        readOnly 
                                            ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                            : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                    }`}
                                />
                            </div>
                        )}

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> {mode === 'inspection' ? 'Aktivitas (Nama Maintenance)' : 'Nama Unit / Peralatan'}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={aktivitas}
                                disabled={readOnly}
                                onChange={e => setAktivitas(e.target.value)}
                                placeholder={mode === 'inspection' ? "Contoh: P.M Maintenance LIFT" : "Contoh: LIFT CAR 1"}
                                className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                    readOnly 
                                        ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                        : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                }`}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Lokasi
                                </span>
                            </label>
                            <input
                                type="text"
                                value={lokasi}
                                disabled={readOnly}
                                onChange={e => setLokasi(e.target.value)}
                                placeholder="Lokasi Pekerjaan"
                                className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                    readOnly 
                                        ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                        : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                }`}
                            />
                        </div>

                        {mode === 'inspection' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-emerald-600" /> Personil
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={personil}
                                        disabled={readOnly}
                                        onChange={e => setPersonil(e.target.value)}
                                        placeholder="Contoh: 4 org"
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                            readOnly 
                                                ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                                : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5 text-emerald-600" /> PIC
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={pic}
                                        disabled={readOnly}
                                        onChange={e => setPic(e.target.value)}
                                        placeholder="Nama PIC"
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                            readOnly 
                                                ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                                : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-emerald-600" /> Anggota
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={anggota}
                                        disabled={readOnly}
                                        onChange={e => setAnggota(e.target.value)}
                                        placeholder="Nama anggota (pisahkan koma)"
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition shadow-sm ${
                                            readOnly 
                                                ? 'bg-slate-50 text-slate-700 border border-slate-200 cursor-not-allowed select-text' 
                                                : 'bg-white text-slate-900 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>

                {mode === 'inspection' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                        <button onClick={() => setChecklistOpen(v => !v)} className="w-full px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100/80 transition cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg"><CheckSquare className="w-4 h-4 text-emerald-700" /></div>
                                <h3 className="text-sm font-bold text-slate-900">Checklist Keselamatan Kerja</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 uppercase tracking-widest shadow-sm">
                                    {Object.values(checklist).filter(v => v).length}/{Object.keys(checklist).length}
                                </div>
                                {checklistOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                        </button>
                        <AnimatePresence>
                            {checklistOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-5 overflow-hidden">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {HSE_CHECKLIST_LABELS.filter(item => !['safeCondition', 'safeAction'].includes(item.key)).map(item => (
                                            <div key={item.key} className="flex flex-col gap-3">
                                                <button 
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() => toggleCheck(item.key)} 
                                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${checklist[item.key] ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-sm' : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${checklist[item.key] ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300'}`}>
                                                            {checklist[item.key] ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                                                        </div>
                                                        <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
                                                    </div>
                                                    <div className={`text-xs font-black ${checklist[item.key] ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                        {checklist[item.key] ? '✓' : 'X'}
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {item.subItems && checklist[item.key] && (
                                                        <motion.div 
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="ml-8 space-y-2 border-l-2 border-emerald-200 pl-4 py-1 overflow-hidden"
                                                        >
                                                            {item.subItems.map(sub => (
                                                                <div key={sub.key} className="space-y-1.5">
                                                                    <button 
                                                                        type="button"
                                                                        disabled={readOnly}
                                                                        onClick={() => toggleCheck(sub.key)}
                                                                        className={`flex items-center gap-3 text-left group transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${checklist[sub.key] ? 'text-emerald-800 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                                                    >
                                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${checklist[sub.key] ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                                                            {checklist[sub.key] && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                        </div>
                                                                        <span className="text-[11px] font-semibold">{sub.label}</span>
                                                                    </button>

                                                                    {sub.key === 'msds' && checklist.msds && (
                                                                        <AnimatePresence>
                                                                            <motion.div
                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                                exit={{ opacity: 0, height: 0 }}
                                                                                className="ml-7 pt-1 pb-1 overflow-hidden"
                                                                            >
                                                                                {msdsFile || msdsPdfUrl ? (
                                                                                    <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                                            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                                                                                                <FileText className="w-4 h-4" />
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-[11px] font-bold text-slate-900 truncate max-w-[170px] sm:max-w-[240px]">
                                                                                                    {msdsFile ? msdsFile.name : 'DOKUMEN MSDS TERSEDIA'}
                                                                                                </p>
                                                                                                <p className="text-[9px] text-emerald-700 font-medium">
                                                                                                    {msdsFile ? `${(msdsFile.size / (1024 * 1024)).toFixed(2)} MB • PDF siap digabung` : 'PDF terlampir'}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                                            {readOnly ? (
                                                                                                msdsPdfUrl && (
                                                                                                    <a
                                                                                                        href={msdsPdfUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noreferrer"
                                                                                                        className="text-[10px] font-bold text-emerald-800 hover:text-emerald-900 bg-white border border-emerald-200 px-2 py-1 rounded-md transition shadow-2xs"
                                                                                                    >
                                                                                                        Lihat PDF
                                                                                                    </a>
                                                                                                )
                                                                                            ) : (
                                                                                                <>
                                                                                                    <label className="text-[10px] font-bold text-emerald-800 hover:text-emerald-900 bg-white border border-emerald-200 hover:border-emerald-300 px-2 py-1 rounded-md cursor-pointer transition shadow-2xs">
                                                                                                        Ganti
                                                                                                        <input
                                                                                                            type="file"
                                                                                                            accept="application/pdf"
                                                                                                            className="hidden"
                                                                                                            onChange={(e) => {
                                                                                                                const file = e.target.files?.[0];
                                                                                                                if (file) {
                                                                                                                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                                                                                                                        toast.error('File harus berformat PDF');
                                                                                                                        return;
                                                                                                                    }
                                                                                                                    setMsdsFile(file);
                                                                                                                    toast.success(`File MSDS dipilih: ${file.name}`);
                                                                                                                }
                                                                                                            }}
                                                                                                        />
                                                                                                    </label>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setMsdsFile(null);
                                                                                                            setMsdsPdfUrl('');
                                                                                                        }}
                                                                                                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 hover:border-rose-300 px-2 py-1 rounded-md cursor-pointer transition shadow-2xs"
                                                                                                    >
                                                                                                        Hapus
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    !readOnly && (
                                                                                        <label className="flex items-center gap-2.5 p-2.5 bg-slate-50/90 border border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl cursor-pointer transition group">
                                                                                            <div className="p-1.5 bg-white border border-slate-200 group-hover:border-emerald-300 rounded-lg text-slate-500 group-hover:text-emerald-600 transition shrink-0">
                                                                                                <Upload className="w-3.5 h-3.5" />
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="text-[10px] font-bold text-slate-700 group-hover:text-emerald-800 uppercase tracking-tight">
                                                                                                    Unggah File MSDS (PDF) <span className="text-[9px] font-normal lowercase text-slate-500">(opsional)</span>
                                                                                                </p>
                                                                                                <p className="text-[9px] text-slate-500 group-hover:text-emerald-600">
                                                                                                    Lampiran PDF akan digabung di akhir laporan inspeksi
                                                                                                </p>
                                                                                            </div>
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="application/pdf"
                                                                                                className="hidden"
                                                                                                onChange={(e) => {
                                                                                                    const file = e.target.files?.[0];
                                                                                                    if (file) {
                                                                                                        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                                                                                                            toast.error('File harus berformat PDF');
                                                                                                            return;
                                                                                                        }
                                                                                                        setMsdsFile(file);
                                                                                                        toast.success(`File MSDS dipilih: ${file.name}`);
                                                                                                    }
                                                                                                }}
                                                                                            />
                                                                                        </label>
                                                                                    )
                                                                                )}
                                                                            </motion.div>
                                                                        </AnimatePresence>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-200">
                                        <div className="flex items-center justify-center gap-3 mb-6">
                                            <div className="h-[1px] flex-1 bg-slate-200" />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Kesimpulan Pekerjaan</p>
                                            <div className="h-[1px] flex-1 bg-slate-200" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {['safeCondition', 'safeAction'].map(key => {
                                                const label = HSE_CHECKLIST_LABELS.find(l => l.key === key)?.label || key;
                                                return (
                                                    <button 
                                                        key={key} 
                                                        type="button"
                                                        disabled={readOnly}
                                                        onClick={() => toggleCheck(key as any)} 
                                                        className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${checklist[key as keyof HSEChecklist] ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${checklist[key as keyof HSEChecklist] ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300'}`}>
                                                                {checklist[key as keyof HSEChecklist] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                                                            </div>
                                                            <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                                                        </div>
                                                        <span className="text-xs font-black">{checklist[key as keyof HSEChecklist] ? '✓' : 'X'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                    <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><Camera className="w-4 h-4 text-blue-700" /></div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Dokumentasi {mode.toUpperCase()}</h3>
                                <p className="text-[11px] text-slate-500 font-medium">{photos.length} Foto Dokumentasi Bukti</p>
                            </div>
                        </div>

                        {photos.length > 0 && (
                            <button
                                type="button"
                                onClick={handleDownloadAllPhotosZip}
                                disabled={isDownloadingZip}
                                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                                title="Download semua foto bukti dalam 1 file ZIP"
                            >
                                {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                                <span>{isDownloadingZip ? 'Mengompres Foto...' : 'Download Semua Foto (.ZIP)'}</span>
                            </button>
                        )}
                    </div>
                    <div className="p-5">
                        {!readOnly && mode === 'sio' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                {['FOTO KTP', 'FOTO SIM', 'FOTO OPERATOR / LAINNYA'].map(label => (
                                    <button
                                        key={label}
                                        onClick={() => { sioLabelRef.current = label; fileInputRef.current?.click(); }}
                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-blue-800 transition font-bold cursor-pointer shadow-sm"
                                    >
                                        <Upload className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">{label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!readOnly && mode === 'silo' && (
                            <button
                                onClick={() => { sioLabelRef.current = 'DOKUMEN SILO'; fileInputRef.current?.click(); }}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-900 transition mb-6 font-bold cursor-pointer shadow-sm"
                            >
                                <Upload className="w-5 h-5" />
                                <span className="text-sm font-bold">UNGGAH DOKUMEN SILO</span>
                            </button>
                        )}

                        {!readOnly && (
                            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e)} className="hidden" title="Unggah Foto Evidence" placeholder="Unggah Foto Evidence" />
                        )}
                        
                        <div className="space-y-4">
                            {!readOnly && (
                                <div 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="group border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-slate-50/50 hover:bg-emerald-50/30"
                                >
                                    <div className="p-3 bg-white border border-slate-200 rounded-xl group-hover:scale-110 group-hover:bg-emerald-100 transition-all shadow-sm">
                                        <Camera className="w-6 h-6 text-slate-500 group-hover:text-emerald-700" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-900">Tambah Foto Evidence</p>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium">Klik untuk upload file</p>
                                    </div>
                                </div>
                            )}

                            {readOnly && photos.length === 0 && (
                                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                                    <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-600">Tidak ada foto dokumentasi pada laporan ini.</p>
                                </div>
                            )}

                            {photos.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {photos.map((photo, index) => (
                                            <motion.div key={photo.id || index} layout className="flex flex-col gap-2">
                                                <div 
                                                    className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100 shadow-sm cursor-pointer"
                                                    onClick={() => setPreviewModalPhoto(photo)}
                                                >
                                                    <img src={photo.dataUrl} alt={photo.description || `Foto ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    {photo.label && (
                                                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                                                            {photo.label}
                                                        </div>
                                                    )}
                                                    
                                                    {readOnly ? (
                                                        <div className="absolute top-2 right-2 flex gap-1 transition" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setPreviewModalPhoto(photo)} 
                                                                className="p-2 bg-slate-900/80 hover:bg-slate-950 text-white rounded-lg shadow-md cursor-pointer transition" 
                                                                title="Perbesar Foto"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => downloadSinglePhoto(photo, index)} 
                                                                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md cursor-pointer transition" 
                                                                title="Download Foto Ini"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="absolute top-2 right-2 flex gap-1 transition" onClick={e => e.stopPropagation()}>
                                                            <button type="button" onClick={() => setEditingPhoto(photo)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md cursor-pointer" title="Edit Foto"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button type="button" onClick={() => removePhoto(photo.id)} className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-md cursor-pointer" title="Hapus Foto"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    )}
                                                </div>

                                                {readOnly ? (
                                                    <div className="space-y-1.5">
                                                        <div 
                                                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-[11px] font-medium truncate"
                                                            title={photo.description || 'Tanpa keterangan'}
                                                        >
                                                            {photo.description || <span className="text-slate-400 italic">Tanpa keterangan</span>}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => downloadSinglePhoto(photo, index)}
                                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                                                            title="Download foto ini langsung"
                                                        >
                                                            <Download className="w-3 h-3 text-emerald-600" />
                                                            Unduh Foto #{index + 1}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={photo.description} 
                                                        onChange={e => setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, description: e.target.value } : p))} 
                                                        placeholder="Keterangan foto..." 
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-[11px] font-medium outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" 
                                                    />
                                                )}
                                            </motion.div>
                                        ))}

                                        {/* Special Inline Upload Card for hse@gmail.com */}
                                        {!readOnly && user?.email?.toLowerCase() === 'hse@gmail.com' && (
                                            <motion.div
                                                key="inline-upload-card"
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="flex flex-col gap-2"
                                            >
                                                <div 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl aspect-[4/3] cursor-pointer transition-all bg-slate-50 hover:bg-emerald-50/50 group/inline"
                                                >
                                                    <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover/inline:scale-105 group-hover/inline:bg-emerald-100 transition-all shadow-sm">
                                                        <Upload className="w-5 h-5 text-slate-500 group-hover/inline:text-emerald-700" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 group-hover/inline:text-slate-900 uppercase tracking-wider">Tambah Foto</span>
                                                </div>
                                                <div className="h-[34px] invisible" aria-hidden="true" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {(mode === 'sio' || mode === 'inspection') && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><ShieldCheck className="w-4 h-4 text-blue-700" /></div>
                            <h3 className="text-sm font-bold text-slate-900">Data SIO & SILO</h3>
                        </div>
                        <div className="p-5 space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-[0.2em]">I. DATA SURAT IZIN OPERATOR (SIO)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="sioOperatorName" className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2">Nama Operator</label>
                                        <input 
                                            id="sioOperatorName" 
                                            type="text" 
                                            value={sioOperatorName} 
                                            readOnly={readOnly}
                                            onChange={e => setSioOperatorName(e.target.value.toUpperCase())} 
                                            className={`w-full px-4 py-2.5 rounded-lg text-xs font-medium outline-none shadow-sm ${readOnly ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500'}`} 
                                            placeholder="ZAINAL" 
                                            title="Nama Operator SIO" 
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="sioNumber" className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2">No SIO / Lisensi</label>
                                        <input 
                                            id="sioNumber" 
                                            type="text" 
                                            value={sioNumber} 
                                            readOnly={readOnly}
                                            onChange={e => setSioNumber(e.target.value.toUpperCase())} 
                                            className={`w-full px-4 py-2.5 rounded-lg text-xs font-medium outline-none shadow-sm ${readOnly ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500'}`} 
                                            placeholder="1234RTYU-BN" 
                                            title="No SIO / Lisensi" 
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="sioExpiryDate" className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2">Masa Berlaku</label>
                                        <input 
                                            id="sioExpiryDate" 
                                            type="date" 
                                            value={sioExpiryDate} 
                                            readOnly={readOnly}
                                            onChange={e => setSioExpiryDate(e.target.value)} 
                                            className={`w-full px-4 py-2.5 rounded-lg text-xs font-medium outline-none shadow-sm ${readOnly ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500'}`} 
                                            title="Masa Berlaku SIO" 
                                            placeholder="Pilih tanggal masa berlaku" 
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-3">Foto Pendukung SIO (KTP/SIM/SIO)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {['KTP', 'SIM', 'KARTU SIO', 'LAINNYA'].map(label => {
                                            const photo = sioPhotos.find(p => p.label === label);
                                            return (
                                                <div key={label} className="flex flex-col gap-2">
                                                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 border border-slate-200 group shadow-sm">
                                                        {photo ? (
                                                            <>
                                                                <img src={photo.dataUrl} className="w-full h-full object-cover cursor-pointer" alt={label} onClick={() => setPreviewModalPhoto(photo)} />
                                                                <div className="absolute top-1 left-1 bg-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white">{label}</div>
                                                                {readOnly ? (
                                                                    <div className="absolute top-1 right-1 flex gap-1">
                                                                        <button type="button" onClick={() => setPreviewModalPhoto(photo)} className="p-1.5 bg-slate-900/80 hover:bg-black rounded-lg text-white transition shadow-md cursor-pointer" title="Lihat Foto"><Eye className="w-3 h-3" /></button>
                                                                        <button type="button" onClick={() => downloadSinglePhoto(photo, 100)} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition shadow-md cursor-pointer" title="Download Foto"><Download className="w-3 h-3" /></button>
                                                                    </div>
                                                                ) : (
                                                                    <button type="button" onClick={() => setSioPhotos(prev => prev.filter(p => p.label !== label))} className="absolute top-1 right-1 p-1 bg-rose-600 rounded text-white transition shadow-md cursor-pointer" title="Hapus Foto SIO"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            readOnly ? (
                                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 p-2 text-center bg-slate-50/60">
                                                                    <span className="text-[9px] font-bold uppercase">{label}</span>
                                                                    <span className="text-[8px] text-slate-400 italic">Tidak dilampirkan</span>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const input = document.createElement('input');
                                                                        input.type = 'file';
                                                                        input.accept = 'image/*';
                                                                        input.onchange = async (e: any) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                const dataUrl = await compressImage(file);
                                                                                setSioPhotos(prev => [...prev.filter(p => p.label !== label), { id: Date.now().toString(), dataUrl, label, description: '' }]);
                                                                            }
                                                                        };
                                                                        input.click();
                                                                    }}
                                                                    className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all cursor-pointer"
                                                                >
                                                                    <Camera className="w-5 h-5" />
                                                                    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                    {label === 'LAINNYA' && photo && (
                                                        <input 
                                                            type="text" 
                                                            value={photo.description || ''} 
                                                            readOnly={readOnly}
                                                            onChange={e => setSioPhotos(prev => prev.map(p => p.label === 'LAINNYA' ? { ...p, description: e.target.value } : p))} 
                                                            placeholder="Keterangan..." 
                                                            className={`w-full px-3 py-1.5 rounded-lg text-[11px] font-medium outline-none shadow-sm ${readOnly ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-900 focus:border-blue-500'}`}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 space-y-4">
                                <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.2em]">II. DOKUMEN SURAT IZIN LAYAK OPERASI (SILO)</h4>
                                <div className="relative group">
                                    {siloFile || siloPdfUrl ? (
                                        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center gap-3 shadow-sm">
                                            <div className="p-3 bg-amber-100 rounded-xl"><FileDown className="w-6 h-6 text-amber-700" /></div>
                                            <div className="text-center">
                                                <p className="text-xs font-black text-slate-900 uppercase">{siloFile ? siloFile.name : 'DOKUMEN SILO TERSEDIA'}</p>
                                                {readOnly ? (
                                                    siloPdfUrl && (
                                                        <a
                                                            href={siloPdfUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs mt-2"
                                                        >
                                                            <FileDown className="w-3.5 h-3.5" />
                                                            Buka Dokumen SILO (PDF)
                                                        </a>
                                                    )
                                                ) : (
                                                    <button type="button" onClick={() => { setSiloFile(null); setSiloPdfUrl(''); }} className="text-[10px] font-bold text-rose-600 hover:underline mt-1 cursor-pointer">Hapus & Ganti File</button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        readOnly ? (
                                            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                                                Tidak ada dokumen SILO terlampir pada laporan ini.
                                            </div>
                                        ) : (
                                            <div 
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'application/pdf';
                                                    input.onchange = (e: any) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setSiloFile(file);
                                                    };
                                                    input.click();
                                                }}
                                                className="p-8 border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-2xl flex flex-col items-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-amber-50/30 transition-all"
                                            >
                                                <Upload className="w-6 h-6 text-slate-500" />
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Unggah Dokumen SILO (PDF)</p>
                                                    <p className="text-[9px] text-slate-500 mt-1 font-medium">Lampiran ini akan digabung ke laporan HSE</p>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => handleGeneratePdf('utt')}
                        disabled={isSaving || isGeneratingPdf || isExporting}
                        className="group relative overflow-hidden px-8 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-2xl border-b-4 border-emerald-800 disabled:border-slate-300 transition-all active:translate-y-1 active:border-b-0 cursor-pointer shadow-md"
                    >
                        <div className="flex items-center justify-center gap-3 text-white">
                            {isGeneratingPdf && isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                            <span className="text-sm font-black uppercase tracking-wider">Ekspor PDF (Logo DME & UTT)</span>
                        </div>
                    </button>

                    <button
                        onClick={() => handleGeneratePdf('neutradc')}
                        disabled={isSaving || isGeneratingPdf || isExporting}
                        className="group relative overflow-hidden px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-2xl border-b-4 border-blue-800 disabled:border-slate-300 transition-all active:translate-y-1 active:border-b-0 cursor-pointer shadow-md"
                    >
                        <div className="flex items-center justify-center gap-3 text-white">
                            {isGeneratingPdf && isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                            <span className="text-sm font-black uppercase tracking-wider">Ekspor PDF (Logo DME & NEUTRADC)</span>
                        </div>
                    </button>
                </div>

                {!readOnly ? (
                    <div className="flex justify-center gap-4 sm:gap-6 pt-2">
                        <button
                            onClick={() => handleSave()}
                            disabled={isSaving || isGeneratingPdf}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition text-xs font-bold uppercase tracking-widest shadow-sm cursor-pointer"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Simpan Draft
                        </button>
                        {!editingData && (
                            <button
                                onClick={handleResetForm}
                                disabled={isSaving || isGeneratingPdf}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl transition text-xs font-bold uppercase tracking-widest shadow-sm cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" />
                                Kosongkan Form
                            </button>
                        )}
                    </div>
                ) : (
                    onClearEdit && (
                        <div className="flex justify-center pt-2">
                            <button
                                type="button"
                                onClick={onClearEdit}
                                className="flex items-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl transition text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Kembali ke Arsip Dokumen HSE
                            </button>
                        </div>
                    )
                )}
            </div>

            <AnimatePresence>
                {previewModalPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setPreviewModalPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200"
                        >
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-emerald-400" />
                                    <span className="font-bold text-sm">
                                        {previewModalPhoto.label || 'Pratinjau Foto Dokumentasi'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => downloadSinglePhoto(previewModalPhoto, 1)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Unduh Foto
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewModalPhoto(null)}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 min-h-[320px]">
                                <img
                                    src={previewModalPhoto.dataUrl}
                                    alt={previewModalPhoto.description || 'Foto Evidence'}
                                    className="max-h-[65vh] max-w-full object-contain rounded-lg"
                                />
                            </div>
                            {previewModalPhoto.description && (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-700 font-medium">
                                    <span className="font-bold text-slate-900">Keterangan:</span> {previewModalPhoto.description}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingPhoto && (
                    <HSEPhotoEditor
                        imageUrl={editingPhoto.dataUrl}
                        onSave={handleSaveEdit}
                        onCancel={() => setEditingPhoto(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
