import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Camera, Upload, Edit2, FileDown,
    CheckSquare, Square, User, MapPin, Users, Briefcase,
    Save, Loader2, ChevronDown, ChevronUp, ClipboardList, Trash2, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { HSEPhotoEditor } from '@/components/HSEPhotoEditor';
import { generateHSEPdf, type HSEFormData } from '@/utils/HSEPdfExport';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, getDocs, deleteDoc, QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { ExcelDocument } from '@/components/DocumentList';
import { compressImage, compressBase64Image } from '@/utils/imageCompression';

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
}

interface HSEReportFormProps {
    editingData?: ExcelDocument | null;
    onClearEdit?: () => void;
    mode?: 'inspection' | 'sio' | 'silo';
}

export function HSEReportForm({ editingData, onClearEdit, mode = 'inspection' }: HSEReportFormProps) {
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

    const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isExported, setIsExported] = useState(false);


    const isInitialMount = useRef(true);



    useEffect(() => {
        if (editingData && editingData.documentType === 'hse') {
            const fetchFullData = async () => {
                const toastId = toast.loading('Memuat data laporan...');
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
                                    dataUrl: p.base64,
                                    label: p.label,
                                    description: p.description || ''
                                })));
                            }
                        }
                        if (data.siloPdfUrl) setSiloPdfUrl(data.siloPdfUrl);

                        const photosSnap = await getDocs(collection(db, `hse/${editingData.id}/photos`));
                        const fetchedPhotos: PhotoItem[] = photosSnap.docs
                            .map((d: QueryDocumentSnapshot) => {
                                const photoData = d.data();
                                return {
                                    id: d.id,
                                    dataUrl: photoData.dataUrl,
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
                    toast.dismiss(toastId);
                } catch (err) {
                    console.error("Error fetching full HSE data:", err);
                    toast.error('Gagal memuat data lengkap', { id: toastId });
                }
            };
            fetchFullData();
        } else if (editingData) {
            setAktivitas(editingData.maintenanceName || '');
            setLokasi(editingData.specificDetail || '');
        }
    }, [editingData, user?.email]);

    useEffect(() => {
        if (editingData || !user?.email) {
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
                } catch (err) {
                    console.error('Failed to load HSE draft:', err);
                }
            }
            setIsDraftLoading(false);
        };
        loadDraft();
    }, [user?.email, editingData, mode]);

    useEffect(() => {
        if (editingData || !user?.email || isDraftLoading || isExporting || isExported) {
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
        sioOperatorName, sioNumber, sioExpiryDate, sioPhotos, siloPdfUrl,
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
        sioOperatorName, sioNumber, sioExpiryDate, sioPhotos, siloFile
    ]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sioLabelRef = useRef<string>('');

    const toggleCheck = (key: keyof HSEChecklist) => {
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
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, label?: string) => {
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
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveEdit = (editedDataUrl: string) => {
        if (!editingPhoto) return;
        setPhotos(prev => prev.map(p =>
            p.id === editingPhoto.id ? { ...p, dataUrl: editedDataUrl } : p
        ));
        setEditingPhoto(null);
        toast.success('Foto berhasil diedit!');
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
            date: new Date().toISOString(),
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
            siloPdfUrl: siloPdfUrl || undefined
        };
    };

    const handleSave = async (silent = false, reportType?: 'utt' | 'neutradc') => {
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
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-4 rounded-2xl border border-emerald-100 shadow-sm mb-2">
                    <div className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        Mode: {editingData ? 'Edit ' : 'Input '}{mode.toUpperCase()}
                    </div>
                    {editingData && (
                        <button onClick={onClearEdit} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold flex items-center gap-2 transition hover:bg-blue-100 shadow-sm cursor-pointer">
                            <Loader2 className="w-4 h-4 animate-spin" /> Batal Edit
                        </button>
                    )}
                </div>

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
                                onChange={e => setInspectorK3(e.target.value)}
                                placeholder="Nama Inspector"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                    onChange={e => setMaintenanceCategory(e.target.value.toUpperCase())}
                                    placeholder="Contoh: PJU, LIFT, GENSET, dll"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition uppercase shadow-sm"
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
                                onChange={e => setAktivitas(e.target.value)}
                                placeholder={mode === 'inspection' ? "Contoh: P.M Maintenance LIFT" : "Contoh: LIFT CAR 1"}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                onChange={e => setLokasi(e.target.value)}
                                placeholder="Lokasi Pekerjaan"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                        onChange={e => setPersonil(e.target.value)}
                                        placeholder="Contoh: 4 org"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                        onChange={e => setPic(e.target.value)}
                                        placeholder="Nama PIC"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                        onChange={e => setAnggota(e.target.value)}
                                        placeholder="Nama anggota (pisahkan koma)"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-sm"
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
                                                <button onClick={() => toggleCheck(item.key)} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${checklist[item.key] ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-sm' : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
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
                                                                <button 
                                                                    key={sub.key} 
                                                                    onClick={() => toggleCheck(sub.key)}
                                                                    className={`flex items-center gap-3 text-left group transition-all cursor-pointer ${checklist[sub.key] ? 'text-emerald-800 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                                                >
                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${checklist[sub.key] ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                                                        {checklist[sub.key] && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                    </div>
                                                                    <span className="text-[11px] font-semibold">{sub.label}</span>
                                                                </button>
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
                                                        onClick={() => toggleCheck(key as any)} 
                                                        className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all cursor-pointer ${checklist[key as keyof HSEChecklist] ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
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
                    <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><Camera className="w-4 h-4 text-blue-700" /></div>
                            <h3 className="text-sm font-bold text-slate-900">Dokumentasi {mode.toUpperCase()}</h3>
                        </div>
                    </div>
                    <div className="p-5">
                        {mode === 'sio' && (
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

                        {mode === 'silo' && (
                            <button
                                onClick={() => { sioLabelRef.current = 'DOKUMEN SILO'; fileInputRef.current?.click(); }}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-900 transition mb-6 font-bold cursor-pointer shadow-sm"
                            >
                                <Upload className="w-5 h-5" />
                                <span className="text-sm font-bold">UNGGAH DOKUMEN SILO</span>
                            </button>
                        )}

                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e)} className="hidden" title="Unggah Foto Evidence" placeholder="Unggah Foto Evidence" />
                        
                        <div className="space-y-4">
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

                            {photos.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {photos.map((photo) => (
                                            <motion.div key={photo.id} layout className="flex flex-col gap-2">
                                                <div className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100 shadow-sm">
                                                    <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                                                    {photo.label && (
                                                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                                                            {photo.label}
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 flex gap-1 transition">
                                                        <button onClick={() => setEditingPhoto(photo)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md cursor-pointer" title="Edit Foto"><Edit2 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => removePhoto(photo.id)} className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-md cursor-pointer" title="Hapus Foto"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>
                                                <input type="text" value={photo.description} onChange={e => setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, description: e.target.value } : p))} placeholder="Keterangan foto..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-[11px] font-medium outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" />
                                            </motion.div>
                                        ))}

                                        {/* Special Inline Upload Card for hse@gmail.com */}
                                        {user?.email?.toLowerCase() === 'hse@gmail.com' && (
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
                                                {/* Placeholder matching the height of photo description input to align grid items */}
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
                                        <input id="sioOperatorName" type="text" value={sioOperatorName} onChange={e => setSioOperatorName(e.target.value.toUpperCase())} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" placeholder="ZAINAL" title="Nama Operator SIO" />
                                    </div>
                                    <div>
                                        <label htmlFor="sioNumber" className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2">No SIO / Lisensi</label>
                                        <input id="sioNumber" type="text" value={sioNumber} onChange={e => setSioNumber(e.target.value.toUpperCase())} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" placeholder="1234RTYU-BN" title="No SIO / Lisensi" />
                                    </div>
                                    <div>
                                        <label htmlFor="sioExpiryDate" className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2">Masa Berlaku</label>
                                        <input id="sioExpiryDate" type="date" value={sioExpiryDate} onChange={e => setSioExpiryDate(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" title="Masa Berlaku SIO" placeholder="Pilih tanggal masa berlaku" />
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
                                                                <img src={photo.dataUrl} className="w-full h-full object-cover" alt={label} />
                                                                <div className="absolute top-1 left-1 bg-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white">{label}</div>
                                                                <button onClick={() => setSioPhotos(prev => prev.filter(p => p.label !== label))} className="absolute top-1 right-1 p-1 bg-rose-600 rounded text-white transition shadow-md cursor-pointer" title="Hapus Foto SIO"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </>
                                                        ) : (
                                                            <button 
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
                                                        )}
                                                    </div>
                                                    {label === 'LAINNYA' && photo && (
                                                        <input 
                                                            type="text" 
                                                            value={photo.description || ''} 
                                                            onChange={e => setSioPhotos(prev => prev.map(p => p.label === 'LAINNYA' ? { ...p, description: e.target.value } : p))} 
                                                            placeholder="Keterangan..." 
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-[11px] font-medium outline-none placeholder-slate-400 focus:border-blue-500 shadow-sm"
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
                                                <button onClick={() => { setSiloFile(null); setSiloPdfUrl(''); }} className="text-[10px] font-bold text-rose-600 hover:underline mt-1 cursor-pointer">Hapus & Ganti File</button>
                                            </div>
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
            </div>

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

