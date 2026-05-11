import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Camera, Upload, Edit2, FileDown, Plus,
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
// Firebase Storage tidak digunakan — hanya Firestore

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
    label?: string; // New: for SIO labels like "KTP", "SIM"
}

interface HSEReportFormProps {
    editingData?: ExcelDocument | null;
    onClearEdit?: () => void;
    mode?: 'inspection' | 'sio' | 'silo';
}

export function HSEReportForm({ editingData, onClearEdit, mode = 'inspection' }: HSEReportFormProps) {
    const { user } = useAuth();

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

    // Integrated SIO/SILO states
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
    }, [aktivitas, lokasi, personil, pic, anggota, inspectorK3, maintenanceCategory, checklist, photos, user?.email, editingData, isDraftLoading, isExporting, mode]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sioLabelRef = useRef<string>('');

    const toggleCheck = (key: keyof HSEChecklist) => {
        setChecklist(prev => {
            const next = { ...prev, [key]: !prev[key] };

            // Logic for Parent -> Children
            if (key === 'ppeKhusus' && !next.ppeKhusus) {
                next.bodyHarness = next.sarungTanganKulit = next.apron = next.kedokLas = next.coverShoes = next.respirator = next.sarungTanganCutResistance = next.pelindungMata = false;
            }
            if (key === 'safetySign' && !next.safetySign) {
                next.pitaBaricade = next.safetyCone = next.stikBariket = next.underMaintenance = false;
            }
            if (key === 'dokumen' && !next.dokumen) {
                next.msds = false;
            }

            // Logic for Children -> Parent
            const ppeChildren = ['bodyHarness', 'sarungTanganKulit', 'apron', 'kedokLas', 'coverShoes', 'respirator', 'sarungTanganCutResistance', 'pelindungMata'];
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
            
            // Optimization: Compress SIO photos even more for Firestore document
            const optimizedSioPhotos = await Promise.all(sioPhotos.map(async (p) => {
                let dataUrl = p.dataUrl;
                try {
                    // SIO photos are just for documentation, keep them small in the main doc
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
                // Core identification fields
                aktivitas: aktivitas || '',
                lokasi: lokasi || '',
                personil: personil || '',
                pic: pic || '',
                anggota: anggota || '',
                inspectorK3: inspectorK3 || user?.email || '',
                date: formData.date,
                // Metadata
                authorEmail: user?.email || '',
                updatedAt: serverTimestamp(),
                reportType: resolvedReportType,
                hseType: mode,
                maintenanceType: maintenanceCategory || 'OTHER',
                // Checklist (stored as flat object in Firestore, not counted per-key)
                checklist,
                // Photos stored as tiny previews in main doc; full photos in sub-collection
                photos: [],
                // Integrated SIO data
                sioData: {
                    operatorName: sioOperatorName || '',
                    sioNumber: sioNumber || '',
                    expiryDate: sioExpiryDate || '',
                    photos: optimizedSioPhotos
                },
            };

            if (editingData && editingData.documentType === 'hse') {
                finalDocId = editingData.id;
                // Use updateDoc for existing records
                await updateDoc(doc(db, 'hse', finalDocId), reportData);
                
                // Safe deletion of old photos
                try {
                    const photosRef = collection(db, `hse/${finalDocId}/photos`);
                    const oldPhotos = await getDocs(photosRef);
                    if (!oldPhotos.empty) {
                        // Delete sequentially or in small chunks to avoid permission/rate limits
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
                // Save full photos to sub-collection
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
            // Build form data locally FIRST (no async needed)
            const formData = buildFormData();
            formData.reportType = reportMode;

            // Run PDF generation & Firestore save IN PARALLEL
            // PDF uses local data → no need to wait for save
            // Save uploads SILO to Storage → can run concurrently
            const [, savedDocId] = await Promise.all([
                // Task 1: Generate & download PDF (local, fast)
                generateHSEPdf(formData).catch((pdfErr) => {
                    console.error('PDF generation failed:', pdfErr);
                    throw new Error(`Gagal membuat PDF: ${(pdfErr as Error)?.message || 'Terjadi kesalahan'}`);
                }),
                // Task 2: Save to Firestore + upload SILO to Storage (may be slow)
                handleSave(true, reportMode).catch((saveErr: any) => {
                    console.error('Save failed:', saveErr);
                    throw new Error(`Gagal menyimpan laporan: ${saveErr?.message || 'Permission ditolak. Pastikan akun Anda memiliki akses HSE.'}`);
                }),
            ]);

            if (!savedDocId) throw new Error('Gagal mendapatkan ID laporan setelah disimpan');

            setIsExported(true);
            if (user?.email && !editingData) {
                draftStorage.remove(`hse_draft_${mode}_${user.email}`).catch(console.error);
            }

            toast.success(`✅ PDF ${reportMode.toUpperCase()} berhasil dibuat & disimpan ke ISO!`, { id: toastId, duration: 4000 });
        } catch (err) {
            console.error('Export Error:', err);
            toast.error((err as Error)?.message || 'Terjadi kesalahan saat export', { id: toastId, duration: 6000 });
        } finally {
            setIsGeneratingPdf(false);
            setIsExporting(false);
        }
    };


    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-700/30 mb-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Mode: {editingData ? 'Edit ' : 'Input '}{mode.toUpperCase()}
                    </div>
                    {editingData && (
                        <button onClick={onClearEdit} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 text-sm font-bold flex items-center gap-2 transition hover:bg-blue-600/30">
                            <Loader2 className="w-4 h-4" /> Batal Edit
                        </button>
                    )}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl"
                >
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
                        <div className="p-2 bg-green-500/15 rounded-lg">
                            <ClipboardList className="w-4 h-4 text-green-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Informasi {mode.toUpperCase()}</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <CheckSquare className="w-3.5 h-3.5" /> Inspector HSE
                                </span>
                            </label>
                            <input
                                type="text"
                                value={inspectorK3}
                                onChange={e => setInspectorK3(e.target.value)}
                                placeholder="Nama Inspector"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {mode !== 'inspection' && (
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase className="w-3.5 h-3.5" /> Jenis Maintenance
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={maintenanceCategory}
                                    onChange={e => setMaintenanceCategory(e.target.value.toUpperCase())}
                                    placeholder="Contoh: PJU, LIFT, GENSET, dll"
                                    className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition uppercase"
                                />
                            </div>
                        )}

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" /> {mode === 'inspection' ? 'Aktivitas (Nama Maintenance)' : 'Nama Unit / Peralatan'}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={aktivitas}
                                onChange={e => setAktivitas(e.target.value)}
                                placeholder={mode === 'inspection' ? "Contoh: P.M Maintenance LIFT" : "Contoh: LIFT CAR 1"}
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Lokasi
                                </span>
                            </label>
                            <input
                                type="text"
                                value={lokasi}
                                onChange={e => setLokasi(e.target.value)}
                                placeholder="Lokasi Pekerjaan"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {mode === 'inspection' && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" /> Personil
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={personil}
                                        onChange={e => setPersonil(e.target.value)}
                                        placeholder="Contoh: 4 org"
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" /> PIC
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={pic}
                                        onChange={e => setPic(e.target.value)}
                                        placeholder="Nama PIC"
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" /> Anggota
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={anggota}
                                        onChange={e => setAnggota(e.target.value)}
                                        placeholder="Nama anggota (pisahkan koma)"
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none"
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
                        className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        <button onClick={() => setChecklistOpen(v => !v)} className="w-full px-5 py-4 border-b border-slate-800/60 flex items-center justify-between hover:bg-slate-800/20 transition">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/15 rounded-lg"><CheckSquare className="w-4 h-4 text-emerald-400" /></div>
                                <h3 className="text-sm font-semibold text-white">Checklist Keselamatan Kerja</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                    {Object.values(checklist).filter(v => v).length}/{Object.keys(checklist).length}
                                </div>
                                {checklistOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        <AnimatePresence>
                            {checklistOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-5 overflow-hidden">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {HSE_CHECKLIST_LABELS.filter(item => !['safeCondition', 'safeAction'].includes(item.key)).map(item => (
                                            <div key={item.key} className="flex flex-col gap-3">
                                                <button onClick={() => toggleCheck(item.key)} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${checklist[item.key] ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/30 border-slate-700/30 text-slate-500'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${checklist[item.key] ? 'bg-emerald-500 text-white' : 'bg-slate-700/50 border border-slate-600/30'}`}>
                                                            {checklist[item.key] ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
                                                    </div>
                                                    <div className={`text-[10px] font-black ${checklist[item.key] ? 'text-emerald-400' : 'text-red-900/40'}`}>
                                                        {checklist[item.key] ? '✓' : 'X'}
                                                    </div>
                                                </button>

                                                {/* Sub Items Rendering - Dropdown style */}
                                                <AnimatePresence>
                                                    {item.subItems && checklist[item.key] && (
                                                        <motion.div 
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="ml-8 space-y-2 border-l-2 border-slate-800/50 pl-4 py-1 overflow-hidden"
                                                        >
                                                            {item.subItems.map(sub => (
                                                                <button 
                                                                    key={sub.key} 
                                                                    onClick={() => toggleCheck(sub.key)}
                                                                    className={`flex items-center gap-3 text-left group transition-all ${checklist[sub.key] ? 'text-emerald-400/80' : 'text-slate-500 hover:text-slate-300'}`}
                                                                >
                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${checklist[sub.key] ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-slate-800/40 border-slate-700/40 group-hover:border-slate-500'}`}>
                                                                        {checklist[sub.key] && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                                                                    </div>
                                                                    <span className="text-[11px] font-medium">{sub.label}</span>
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>

                                    {/* KESIMPULAN PEKERJAAN */}
                                    <div className="mt-8 pt-6 border-t border-slate-800/60">
                                        <div className="flex items-center justify-center gap-3 mb-6">
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Kesimpulan Pekerjaan</p>
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {['safeCondition', 'safeAction'].map(key => {
                                                const label = HSE_CHECKLIST_LABELS.find(l => l.key === key)?.label || key;
                                                return (
                                                    <button 
                                                        key={key} 
                                                        onClick={() => toggleCheck(key as any)} 
                                                        className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${checklist[key as keyof HSEChecklist] ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900/40 border-slate-800/60 text-slate-600'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${checklist[key as keyof HSEChecklist] ? 'bg-emerald-500 text-white' : 'bg-slate-800'}`}>
                                                                {checklist[key as keyof HSEChecklist] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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
                    className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl"
                >
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/15 rounded-lg"><Camera className="w-4 h-4 text-blue-400" /></div>
                            <h3 className="text-sm font-semibold text-white">Dokumentasi {mode.toUpperCase()}</h3>
                        </div>
                    </div>
                    <div className="p-5">
                        {mode === 'sio' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                {['FOTO KTP', 'FOTO SIM', 'FOTO OPERATOR / LAINNYA'].map(label => (
                                    <button
                                        key={label}
                                        onClick={() => { sioLabelRef.current = label; fileInputRef.current?.click(); }}
                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-blue-400 transition"
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
                                className="w-full flex items-center justify-center gap-3 p-4 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/20 rounded-xl text-orange-400 transition mb-6"
                            >
                                <Upload className="w-5 h-5" />
                                <span className="text-sm font-bold">UNGGAH DOKUMEN SILO</span>
                            </button>
                        )}

                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e)} className="hidden" />
                        
                        {photos.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <AnimatePresence>
                                    {photos.map((photo) => (
                                        <motion.div key={photo.id} className="flex flex-col gap-2">
                                            <div className="relative group rounded-xl overflow-hidden border border-slate-700/40 aspect-[4/3] bg-slate-950">
                                                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                                                {photo.label && (
                                                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg">
                                                        {photo.label}
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => setEditingPhoto(photo)} className="p-1.5 bg-blue-600 text-white rounded-md"><Edit2 className="w-3 h-3" /></button>
                                                    <button onClick={() => removePhoto(photo.id)} className="p-1.5 bg-red-600 text-white rounded-md"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={photo.description}
                                                onChange={e => setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, description: e.target.value } : p))}
                                                placeholder="Keterangan..."
                                                className="w-full px-3 py-2 bg-slate-900/40 border border-slate-700/50 rounded-lg text-white text-[10px] outline-none"
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                <button onClick={() => fileInputRef.current?.click()} className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-700/50 flex flex-col items-center justify-center text-slate-500 hover:text-green-400 hover:border-green-500/40 transition">
                                    <Plus className="w-6 h-6" /><span className="text-[10px]">Tambah</span>
                                </button>
                            </div>
                        ) : mode === 'inspection' && (
                            <button onClick={() => fileInputRef.current?.click()} className="w-full p-10 border-2 border-dashed border-slate-700/50 rounded-xl flex flex-col items-center gap-2 text-slate-500 hover:text-blue-400 transition">
                                <Upload className="w-8 h-8" /><span className="text-sm">Pilih Foto Dokumentasi</span>
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* SIO & SILO INTEGRATION SECTION */}
                {mode === 'inspection' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl space-y-6 p-6"
                    >
                        <div className="flex items-center gap-3 border-b border-slate-800/60 pb-4">
                            <div className="p-2 bg-blue-500/15 rounded-lg"><ShieldCheck className="w-4 h-4 text-blue-400" /></div>
                            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Integrasi Data SIO & SILO</h3>
                        </div>

                        {/* SIO DATA SECTION */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">I. DATA SURAT IZIN OPERATOR (SIO)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Nama Operator</label>
                                    <input
                                        type="text"
                                        value={sioOperatorName}
                                        onChange={e => setSioOperatorName(e.target.value)}
                                        placeholder="Nama Lengkap"
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-blue-500/40 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">No SIO / Lisensi</label>
                                    <input
                                        type="text"
                                        value={sioNumber}
                                        onChange={e => setSioNumber(e.target.value)}
                                        placeholder="No Registrasi"
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-blue-500/40 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Masa Berlaku</label>
                                    <input
                                        type="date"
                                        value={sioExpiryDate}
                                        onChange={e => setSioExpiryDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-blue-500/40 transition"
                                    />
                                </div>
                            </div>

                            {/* SIO PHOTOS */}
                            <div className="pt-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">Foto Pendukung SIO (KTP/SIM/SIO)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['KTP', 'SIM', 'KARTU SIO', 'LAINNYA'].map(label => {
                                        const photo = sioPhotos.find(p => p.label === label);
                                        return (
                                            <div key={label} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30">
                                                {photo ? (
                                                    <>
                                                        <img src={photo.dataUrl} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                            <button onClick={() => setSioPhotos(prev => prev.filter(p => p.label !== label))} className="p-2 bg-red-500/20 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-[8px] font-bold text-white rounded uppercase">{label}</div>
                                                    </>
                                                ) : (
                                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/20 transition gap-2">
                                                        <Camera className="w-5 h-5 text-slate-500" />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const compressed = await compressImage(file, { maxWidth: 800, quality: 0.6 });
                                                                    setSioPhotos(prev => [...prev.filter(p => p.label !== label), { id: Math.random().toString(), dataUrl: compressed, description: '', label }]);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* SILO DATA SECTION */}
                        <div className="space-y-4 pt-4 border-t border-slate-800/60">
                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">II. DOKUMEN SURAT IZIN LAYAK OPERASI (SILO)</p>
                            <div className="bg-slate-950/40 border border-slate-700/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center">
                                {siloFile || siloPdfUrl ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-orange-500/10 rounded-full border border-orange-500/20">
                                            <FileDown className="w-8 h-8 text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white truncate max-w-[250px]">
                                                {siloFile?.name || 'Dokumen SILO Tersimpan'}
                                            </p>
                                            <button onClick={() => { setSiloFile(null); setSiloPdfUrl(''); }} className="text-xs text-red-400 hover:underline mt-1 font-bold">Hapus & Ganti File</button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="w-full flex flex-col items-center gap-3 cursor-pointer group">
                                        <div className="p-4 bg-slate-800/50 rounded-full border border-slate-700/50 group-hover:bg-orange-500/10 group-hover:border-orange-500/30 transition">
                                            <Upload className="w-8 h-8 text-slate-500 group-hover:text-orange-400 transition" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-white">Upload Dokumen SILO (PDF)</p>
                                            <p className="text-[10px] text-slate-500">Klik untuk memilih file dari perangkat Anda</p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            className="hidden"
                                            onChange={(e) => setSiloFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={() => handleGeneratePdf('utt')} disabled={isGeneratingPdf} className="flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition disabled:opacity-50">
                            <FileDown className="w-4 h-4" /> Ekspor PDF (Logo DME & UTT)
                        </button>
                        <button onClick={() => handleGeneratePdf('neutradc')} disabled={isGeneratingPdf} className="flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition disabled:opacity-50">
                            <FileDown className="w-4 h-4" /> Ekspor PDF (Logo DME & NEUTRADC)
                        </button>
                    </div>
                    <button onClick={() => handleSave()} disabled={isSaving} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs">
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {editingData ? 'Perbarui di Database' : 'Simpan Draft'}
                    </button>
                </div>

                <p className="text-center text-[10px] text-slate-600 pb-4 mt-4 tracking-[0.2em] uppercase">🛡️ HSE Safety System 🛡️</p>
            </div>
            <AnimatePresence>
                {editingPhoto && <HSEPhotoEditor imageUrl={editingPhoto.dataUrl} onSave={handleSaveEdit} onCancel={() => setEditingPhoto(null)} />}
            </AnimatePresence>
        </>
    );
}
