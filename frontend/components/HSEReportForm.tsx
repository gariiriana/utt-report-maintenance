import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Camera, Upload, Edit2, FileDown, Plus,
    CheckSquare, Square, User, MapPin, Users, Briefcase,
    Save, Loader2, ChevronDown, ChevronUp, ClipboardList, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { HSEPhotoEditor } from '@/components/HSEPhotoEditor';
import { generateHSEPdf, type HSEFormData, type HSEChecklist } from '@/utils/HSEPdfExport';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, getDocs, deleteDoc, QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { ExcelDocument } from '@/components/DocumentList';
import { compressImage, compressBase64Image } from '@/utils/imageCompression';

const INITIAL_CHECKLIST: HSEChecklist = {
    mop: false,
    jsa: false,
    ptw: false,
    ppe: false,
    toolsBertagging: false,
    logMaintenance: false,
    housekeeping: false,
    safeCondition: false,
    safeAction: false,
    safetySign: false,
    ppeKhusus: false,
    bodyHarness: false,
    sarungTanganKulit: false,
    apron: false,
    kedokLas: false,
    coverShoes: false,
    respirator: false,
    pitaBaricade: false,
    safetyCone: false,
    stikBariket: false,
};

const CHECKLIST_LABELS: { key: keyof HSEChecklist; label: string; subItems?: { key: keyof HSEChecklist; label: string }[] }[] = [
    { key: 'mop', label: 'MOP' },
    { key: 'jsa', label: 'JSA' },
    { key: 'ptw', label: 'PTW' },
    { key: 'ppe', label: 'PPE Mandatory' },
    { 
        key: 'ppeKhusus', 
        label: 'PPE Khusus',
        subItems: [
            { key: 'bodyHarness', label: 'Body Harness' },
            { key: 'sarungTanganKulit', label: 'Sarung Tangan Kulit' },
            { key: 'apron', label: 'Apron' },
            { key: 'kedokLas', label: 'Kedok Las' },
            { key: 'coverShoes', label: 'Cover Shoes' },
            { key: 'respirator', label: 'Respirator' },
        ]
    },
    { key: 'toolsBertagging', label: 'Tools Bertagging & sdh di-checklist' },
    { key: 'logMaintenance', label: 'Log Maintenance' },
    { key: 'housekeeping', label: 'Housekeeping Area Kerja' },
    { 
        key: 'safetySign', 
        label: 'Safety Sign',
        subItems: [
            { key: 'pitaBaricade', label: 'Pita Baricade' },
            { key: 'safetyCone', label: 'Safety Cone' },
            { key: 'stikBariket', label: 'Stik Bariket' },
        ]
    },
    { key: 'safeCondition', label: 'Safe Condition' },
    { key: 'safeAction', label: 'Safe Action' },
];

interface PhotoItem {
    id: string;
    dataUrl: string;
    description: string;
}

interface HSEReportFormProps {
    editingData?: ExcelDocument | null;
    onClearEdit?: () => void;
}

export function HSEReportForm({ editingData, onClearEdit }: HSEReportFormProps) {
    const { user } = useAuth();

    const [aktivitas, setAktivitas] = useState('');
    const [lokasi, setLokasi] = useState('');
    const [personil, setPersonil] = useState('');
    const [pic, setPic] = useState('');
    const [anggota, setAnggota] = useState('');
    const [inspectorK3, setInspectorK3] = useState('');
    const [checklist, setChecklist] = useState<HSEChecklist>({ ...INITIAL_CHECKLIST });
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [checklistOpen, setChecklistOpen] = useState(true);

    const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        if (editingData && editingData.documentType === 'hse') {
            const fetchFullData = async () => {
                const toastId = toast.loading('Loading report data...');
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
                        if (data.checklist) setChecklist(data.checklist);

                        const photosSnap = await getDocs(collection(db, `hse/${editingData.id}/photos`));
                        const fetchedPhotos: PhotoItem[] = photosSnap.docs
                            .map((d: QueryDocumentSnapshot) => {
                                const photoData = d.data();
                                return {
                                    id: d.id,
                                    dataUrl: photoData.dataUrl,
                                    description: photoData.description || '',
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
    }, [editingData]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleCheck = (key: keyof HSEChecklist) => {
        setChecklist(prev => {
            const next = { ...prev, [key]: !prev[key] };

            if (key === 'ppeKhusus' && !next.ppeKhusus) {
                next.bodyHarness = next.sarungTanganKulit = next.apron = next.kedokLas = next.coverShoes = next.respirator = false;
            }
            if (key === 'safetySign' && !next.safetySign) {
                next.pitaBaricade = next.safetyCone = next.stikBariket = false;
            }

            const ppeChildren = ['bodyHarness', 'sarungTanganKulit', 'apron', 'kedokLas', 'coverShoes', 'respirator'];
            if (ppeChildren.includes(key as string) && next[key as keyof HSEChecklist]) {
                next.ppeKhusus = true;
            }
            const safetyChildren = ['pitaBaricade', 'safetyCone', 'stikBariket'];
            if (safetyChildren.includes(key as string) && next[key as keyof HSEChecklist]) {
                next.safetySign = true;
            }

            return next;
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach(async file => {
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} bukan file gambar`);
                return;
            }
            try {
                const dataUrl = await compressImage(file);
                setPhotos(prev => [...prev, { id: Date.now().toString() + Math.random(), dataUrl, description: '' }]);
            } catch (err) {
                console.error("Compression failed", err);
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setPhotos(prev => [...prev, { id: Date.now().toString() + Math.random(), dataUrl, description: '' }]);
                };
                reader.readAsDataURL(file);
            }
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
        toast.success(`${files.length} foto ditambahkan`);
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

    const buildFormData = (): HSEFormData => ({
        aktivitas,
        lokasi,
        personil,
        pic,
        anggota,
        inspectorK3,
        checklist,
        photos: photos.map(p => ({
            base64: p.dataUrl,
            description: p.description
        })),
        date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
    });

    const saveReportViaAPI = async (formData: HSEFormData, extraData: any) => {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) throw new Error('API URL not configured');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Secret': import.meta.env.VITE_API_SECRET || '',
            },
            body: JSON.stringify({
                collection: 'hse',
                sub_data: extraData.photos,
                ...formData,
                processedBy: 'golang_api',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${errorText}`);
        }

        const result = await response.json();
        return result.reportId;
    };

    const handleSave = async () => {
        if (!aktivitas.trim()) {
            toast.error('Aktivitas wajib diisi');
            return;
        }
        setIsSaving(true);
        const toastId = toast.loading(editingData ? 'Memperbarui laporan...' : 'Menyimpan laporan...');
        try {
            const formData = buildFormData();
            const reportData = {
                ...formData,
                photos: photos.map(p => p.dataUrl.substring(0, 50) + '...'),
                authorEmail: user?.email || '',
                updatedAt: serverTimestamp(),
            };

            let docId = '';
            const isUsingAPI = !!import.meta.env.VITE_API_URL;

            if (isUsingAPI && !(editingData && editingData.documentType === 'hse')) {
                docId = await saveReportViaAPI(formData, {
                    authorEmail: user?.email || '',
                    createdAt: new Date().toISOString(),
                });
            } else if (editingData && editingData.documentType === 'hse') {
                docId = editingData.id;
                await updateDoc(doc(db, 'hse', docId), reportData);

                const photosRef = collection(db, `hse/${docId}/photos`);
                const oldPhotos = await getDocs(photosRef);
                for (const pDoc of oldPhotos.docs) {
                    await deleteDoc(doc(db, `hse/${docId}/photos`, pDoc.id));
                }
            } else {
                const docRef = await addDoc(collection(db, 'hse'), {
                    ...reportData,
                    createdAt: serverTimestamp(),
                });
                docId = docRef.id;
            }

            for (let i = 0; i < photos.length; i++) {
                let dataUrl = photos[i].dataUrl;
                const sizeInBytes = (dataUrl.length * 3) / 4;

                if (sizeInBytes > 800 * 1024) {
                    try {
                        dataUrl = await compressBase64Image(dataUrl, { maxWidth: 800, quality: 0.5 });
                    } catch (err) {
                        console.error("HSE Compression failure", err);
                    }
                }

                await addDoc(collection(db, `hse/${docId}/photos`), {
                    index: i + 1,
                    dataUrl: dataUrl,
                    description: photos[i].description || '',
                    createdAt: serverTimestamp(),
                });
            }

            toast.success(editingData ? 'Laporan HSE diperbarui!' : 'Laporan HSE tersimpan!', { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error('Gagal menyimpan laporan', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    // Generate PDF
    const handleGeneratePdf = async (mode: 'utt' | 'neutradc' = 'neutradc') => {
        if (!aktivitas.trim()) {
            toast.error('Aktivitas wajib diisi sebelum export PDF');
            return;
        }
        setIsGeneratingPdf(true);
        try {
            const formData = buildFormData();
            formData.reportType = mode;
            await generateHSEPdf(formData);
            toast.success(`PDF ${mode.toUpperCase()} berhasil digenerate!`);
        } catch (err) {
            console.error(err);
            toast.error('Gagal generate PDF');
        } finally {
            setIsGeneratingPdf(false);
        }
    };




    return (
        <>
            <div className="space-y-6">
                {editingData && (
                    <div className="flex justify-end">
                        <button onClick={onClearEdit} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 text-sm font-bold flex items-center gap-2">
                            <Loader2 className="w-4 h-4" /> Clear Edit Mode
                        </button>
                    </div>
                )}

                {/* ── INFO SECTION ───────────────────────────────────────────── */}
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
                        <h3 className="text-sm font-semibold text-white">Informasi Pekerjaan</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Inspector K3 */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <CheckSquare className="w-3.5 h-3.5" /> Inspector K3
                                </span>
                            </label>
                            <input
                                type="text"
                                value={inspectorK3}
                                onChange={e => setInspectorK3(e.target.value)}
                                placeholder="Masukkan nama Inspector K3"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {/* Aktivitas */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" /> Aktivitas (Nama Maintenance)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={aktivitas}
                                onChange={e => setAktivitas(e.target.value)}
                                placeholder="Contoh: P.M Maintenance LIFT"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {/* Lokasi */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Lokasi Maintenance
                                </span>
                            </label>
                            <input
                                type="text"
                                value={lokasi}
                                onChange={e => setLokasi(e.target.value)}
                                placeholder="Contoh: Gedung CAMPUS LIFT - DB -3"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {/* Personil */}
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
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {/* PIC */}
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
                                placeholder="Contoh: Acep Karim"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                        </div>

                        {/* Anggota */}
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
                                placeholder="Contoh: Tantan, Firman, Budi"
                                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 transition"
                            />
                            <p className="text-xs text-slate-500 mt-1.5">Pisahkan nama dengan koma</p>
                        </div>

                        </div>
                </motion.div>

                {/* ── CHECKLIST SECTION ──────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 }}
                    className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl"
                >
                    <button
                        onClick={() => setChecklistOpen(v => !v)}
                        className="w-full px-5 py-4 border-b border-slate-800/60 flex items-center justify-between hover:bg-slate-800/20 transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/15 rounded-lg">
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-white">Checklist Keselamatan Kerja</h3>
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-medium">
                                {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_LABELS.length}
                            </span>
                        </div>
                        {checklistOpen ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </button>

                    <AnimatePresence>
                        {checklistOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                            >
                                <div className="p-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {CHECKLIST_LABELS.filter(item => !['safeCondition', 'safeAction'].includes(item.key)).map((item) => {
                                            const checked = checklist[item.key];
                                            const hasSubItems = item.subItems && item.subItems.length > 0;

                                            return (
                                                <div key={item.key} className="flex flex-col gap-2">
                                                    <motion.button
                                                        whileTap={{ scale: 0.97 }}
                                                        onClick={() => toggleCheck(item.key)}
                                                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${checked
                                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                            : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/60 hover:text-slate-300'
                                                            }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
                                                            }`}>
                                                            {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <span className="text-sm font-medium">{item.label}</span>
                                                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${checked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400/60'}`}>
                                                            {checked ? '✓' : '✗'}
                                                        </span>
                                                    </motion.button>

                                                    <AnimatePresence>
                                                        {checked && hasSubItems && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden ml-6 pl-4 border-l-2 border-slate-700/50 flex flex-col gap-2"
                                                            >
                                                                {item.subItems?.map(sub => (
                                                                    <button
                                                                        key={sub.key}
                                                                        onClick={() => toggleCheck(sub.key)}
                                                                        className={`flex items-center gap-3 py-1.5 transition ${checklist[sub.key] ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-400'
                                                                            }`}
                                                                    >
                                                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center ${checklist[sub.key] ? 'bg-emerald-500 text-white' : 'bg-slate-800 border border-slate-700'
                                                                            }`}>
                                                                            {checklist[sub.key] && <CheckSquare className="w-2.5 h-2.5" />}
                                                                        </div>
                                                                        <span className="text-xs">{sub.label}</span>
                                                                    </button>
                                                                ))}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="my-6 border-t border-slate-700/50 relative">
                                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                                            Kesimpulan Pekerjaan
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {CHECKLIST_LABELS.filter(item => ['safeCondition', 'safeAction'].includes(item.key)).map(({ key, label }) => {
                                            const checked = checklist[key];
                                            return (
                                                <motion.button
                                                    key={key}
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={() => toggleCheck(key)}
                                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${checked
                                                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                                        : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/60 hover:text-slate-300'
                                                        }`}
                                                >
                                                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition ${checked ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-500'
                                                        }`}>
                                                        {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{label}</span>
                                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${checked ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/10 text-red-400/60'}`}>
                                                        {checked ? '✓' : '✗'}
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl"
                >
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/15 rounded-lg">
                                <Camera className="w-4 h-4 text-blue-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-white">Foto Dokumentasi</h3>
                            {photos.length > 0 && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full font-medium">
                                    {photos.length} foto
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="flex gap-3 mb-5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition font-medium text-sm"
                            >
                                <Upload className="w-4 h-4" />
                                Upload dari Device
                            </motion.button>
                        </div>


                        {photos.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <AnimatePresence>
                                    {photos.map((photo, idx) => (
                                        <motion.div
                                            key={photo.id}
                                            initial={{ opacity: 0, scale: 0.85 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.85 }}
                                            className="flex flex-col gap-2"
                                        >
                                            <div className="relative group rounded-xl overflow-hidden border border-slate-700/40 aspect-[4/3] bg-slate-950">
                                                <img
                                                    src={photo.dataUrl}
                                                    alt={`Foto ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingPhoto(photo); }}
                                                        className="p-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-md transition shadow-md"
                                                        title="Edit Foto"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                                                        className="p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-md transition shadow-md"
                                                        title="Hapus Foto"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-slate-700/50">
                                                    {idx + 1}
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={photo.description}
                                                onChange={(e) => {
                                                    const newDesc = e.target.value;
                                                    setPhotos(prev => prev.map(p =>
                                                        p.id === photo.id ? { ...p, description: newDesc } : p
                                                    ));
                                                }}
                                                placeholder="Tambah deskripsi..."
                                                className="w-full px-3 py-2 bg-slate-900/40 border border-slate-700/50 rounded-lg text-white text-[11px] placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition"
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-xl border-2 border-dashed border-slate-700/50 hover:border-green-500/40 text-slate-600 hover:text-green-400 transition flex flex-col items-center justify-center gap-2"
                                >
                                    <Plus className="w-6 h-6" />
                                    <span className="text-xs">Tambah Foto</span>
                                </motion.button>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="border-2 border-dashed border-slate-700/50 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-slate-600"
                            >
                                <Camera className="w-10 h-10 opacity-40" />
                                <p className="text-sm text-center">
                                    Belum ada foto.<br />
                                    Silakan upload dari device.
                                </p>
                            </motion.div>
                        )}
                    </div>
                </motion.div>

                {/* ── ACTION BUTTONS ─────────────────────────────────────────── */}
                <div className="space-y-4">
                    {/* UTT Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-[1px] flex-1 bg-slate-800"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reports for UTT</span>
                            <div className="h-[1px] flex-1 bg-slate-800"></div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleGeneratePdf('utt')}
                                disabled={isGeneratingPdf || isSaving}
                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition shadow-lg shadow-green-900/20 text-sm disabled:opacity-50"
                            >
                                <FileDown className="w-4 h-4" /> Export PDF (UTT)
                            </motion.button>
                        </div>
                    </div>

                    {/* NeutraDC Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-[1px] flex-1 bg-slate-800"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reports for NeutraDC</span>
                            <div className="h-[1px] flex-1 bg-slate-800"></div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleGeneratePdf('neutradc')}
                                disabled={isGeneratingPdf || isSaving}
                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-900/20 text-sm disabled:opacity-50"
                            >
                                <FileDown className="w-4 h-4" /> Export PDF (NeutraDC)
                            </motion.button>
                        </div>
                    </div>
                    
                    {/* General Save */}
                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2.5 py-3 bg-slate-900/40 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-xl font-medium transition text-xs disabled:opacity-50 mt-2"
                    >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {editingData ? 'Update Laporan ke Database' : 'Simpan Draft ke Database'}
                    </motion.button>
                </div>

                {/* Catatan bawah */}
                <p className="text-center text-[10px] text-slate-600 pb-4 mt-4 uppercase tracking-[0.2em]">
                    🛡️ Safety Implementation System 🛡️
                </p>
            </div>

            {/* Photo Editor Modal */}
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
