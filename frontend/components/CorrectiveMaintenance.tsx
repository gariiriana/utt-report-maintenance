import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Plus,
    Camera,
    MapPin,
    PenTool,
    AlertCircle,
    CheckCircle2,
    Trash2,
    X,
    Loader2,
    FileText,
    Scissors,
    Calendar,
    User
} from 'lucide-react';
import { ImageEditor } from './ImageEditor';
import { toast } from 'sonner';
import { db, auth } from '@/api/firebase';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc,
    updateDoc
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { SLAForm } from './SLAForm';
import { exportSLAReportToExcel } from '../utils/excelExport';
import { exportMonthlyPDF } from '../utils/pdfExport';

interface CorrectiveReport {
    id: string;
    issue: string;
    actionTaken: string;
    spareParts: string;
    status: 'Open' | 'InProgress' | 'Resolved';
    location: string;
    photoBase64: string;
    photoDescription: string;
    quarter: string;
    year: string;
    category: string;
    reportedBy: string;
    reportedByEmail: string;
    reportedAt: any;

    // SLA fields
    reportType?: 'SLA';
    ticketName?: string;
    priority?: 'Low' | 'Medium' | 'High';
    picDME?: string;
    picTDE?: string;
    remark?: string;
    actualResponseTimeMin?: number;
    targetResponseMin?: number;
    responseComply?: boolean;
    photoResponse?: string;
    photoEngineerOnsite?: string;
    actualOnsiteTimeMin?: number;
    targetOnsiteMin?: number;
    onsiteComply?: boolean;
    photoOnsite?: string;
    actualRestoreTimeMin?: number;
    targetRestoreMin?: number;
    restoreComply?: boolean;
    photoRestore?: string;
    actualResolutionTimeMin?: number;
    targetResolutionMin?: number;
    resolutionComply?: boolean;
    photoResolution?: string;
}

interface CorrectiveMaintenanceProps {
    readOnly?: boolean;
}

const INDO_MONTHS = [
    { value: '0', label: 'Januari' },
    { value: '1', label: 'Februari' },
    { value: '2', label: 'Maret' },
    { value: '3', label: 'April' },
    { value: '4', label: 'Mei' },
    { value: '5', label: 'Juni' },
    { value: '6', label: 'Juli' },
    { value: '7', label: 'Agustus' },
    { value: '8', label: 'September' },
    { value: '9', label: 'Oktober' },
    { value: '10', label: 'November' },
    { value: '11', label: 'Desember' }
];

export function CorrectiveMaintenance({ readOnly = false }: CorrectiveMaintenanceProps) {
    const { user, userRole } = useAuth();
    const canCreate = !readOnly && (userRole === 'engineer' || userRole === 'standby_engineer' || userRole === 'admin');
    const canDelete = !readOnly && (userRole === 'admin' || userRole === 'engineer' || userRole === 'standby_engineer');

    const [reports, setReports] = useState<CorrectiveReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reportFormType, setReportFormType] = useState<'standard' | 'sla' | null>(null);

    const [formData, setFormData] = useState({
        issue: '',
        actionTaken: '',
        spareParts: '',
        status: 'Open' as 'Open' | 'InProgress' | 'Resolved',
        location: '',
        photoBase64: '',
        photoDescription: '',
        quarter: 'Q1',
        year: new Date().getFullYear().toString(),
    });

    const [editingPhoto, setEditingPhoto] = useState(false);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);

    // Filters State
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');

    useEffect(() => {
        if (!user) {
            setReports([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as CorrectiveReport[];
                setReports(data);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading CM reports:', error);
                toast.error('Failed to load reports');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            toast.error('Max photo size is 20MB');
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
                setFormData({ ...formData, photoBase64: compressedBase64 });
            };
        };
    };

    const handleApplyEdit = (editedBase64: string) => {
        setFormData({ ...formData, photoBase64: editedBase64 });
        setEditingPhoto(false);
        toast.success('Photo updated');
    };

    const saveReportViaAPI = async (apiUrl: string, reportData: any) => {
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
                    collection: 'corrective_reports',
                    ...reportData,
                    processedBy: 'golang_api',
                }),
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const result = await response.json();
            return result.reportId;
        } catch (error) {
            console.error('API Save Error:', error);
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.issue || !formData.actionTaken || !formData.location) {
            toast.error('Please fill in required fields (Issue, Action, Location)');
            return;
        }
        if (!formData.photoBase64) {
            toast.error('Please upload 1 evidence photo');
            return;
        }

        setSubmitting(true);
        try {
            const reportData = {
                ...formData,
                category: 'CM',
                reportedBy: user.uid,
                reportedByEmail: user.email,
                reportedAt: serverTimestamp(),
            };

            if (editingReportId) {
                await updateDoc(doc(db, 'corrective_reports', editingReportId), reportData);
                toast.success('Corrective report updated!');
                setEditingReportId(null);
            } else {
                const apiUrl = import.meta.env.VITE_API_URL;
                if (apiUrl) {
                    const docIdFromAPI = await saveReportViaAPI(apiUrl, reportData);
                    if (docIdFromAPI) {
                        toast.success('Corrective report created (via API)!');
                        setShowForm(false);
                        setFormData({
                            issue: '',
                            actionTaken: '',
                            spareParts: '',
                            status: 'Open',
                            location: '',
                            photoBase64: '',
                            photoDescription: '',
                            quarter: 'Q1',
                            year: new Date().getFullYear().toString(),
                        });
                        return;
                    }
                }

                await addDoc(collection(db, 'corrective_reports'), reportData);
                toast.success('Corrective report created!');
            }

            setShowForm(false);
            setFormData({
                issue: '',
                actionTaken: '',
                spareParts: '',
                status: 'Open',
                location: '',
                photoBase64: '',
                photoDescription: '',
                quarter: 'Q1',
                year: new Date().getFullYear().toString(),
            });
        } catch (error) {
            console.error('Error saving report:', error);
            toast.error('Failed to save report');
        } finally {
            setSubmitting(false);
        }
    };

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDoc(doc(db, 'corrective_reports', deleteId));
            toast.success('Report deleted');
        } catch (error) {
            toast.error('Failed to delete report');
        } finally {
            setDeleteId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'InProgress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };

    // Filter Logic
    const filteredReports = reports.filter((report) => {
        // Tab check
        if (readOnly) {
            // Under Archive, show all reports normally, but we filter them dynamically
        }

        // Date check
        if (report.reportedAt) {
            const reportDate = report.reportedAt.toDate?.();
            if (reportDate) {
                if (selectedMonth !== 'all') {
                    if (reportDate.getMonth().toString() !== selectedMonth) {
                        return false;
                    }
                }
                if (selectedYear !== 'all') {
                    if (reportDate.getFullYear().toString() !== selectedYear) {
                        return false;
                    }
                }
            }
        }

        // Query check
        if (searchQuery.trim() !== '') {
            const queryText = searchQuery.toLowerCase();
            const locationMatch = report.location?.toLowerCase().includes(queryText);
            const issueMatch = report.issue?.toLowerCase().includes(queryText);
            const actionMatch = report.actionTaken?.toLowerCase().includes(queryText);
            const ticketMatch = report.ticketName?.toLowerCase().includes(queryText);
            const remarkMatch = report.remark?.toLowerCase().includes(queryText);
            
            return locationMatch || issueMatch || actionMatch || ticketMatch || remarkMatch;
        }

        return true;
    });

    const seedDummyData = async () => {
        if (!user) {
            toast.error('Anda harus login terlebih dahulu!');
            return;
        }

        toast.loading('Menambahkan data dummy...', { id: 'seeding' });
        try {
            // Helper: generate a visible colored placeholder image via Canvas
            const generatePlaceholderImage = (label: string, bgColor: string, textColor: string = '#ffffff'): string => {
                const canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 200;
                const ctx = canvas.getContext('2d')!;

                // Background
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, 200, 200);

                // Diagonal stripes for texture
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 12;
                for (let i = -200; i < 400; i += 30) {
                    ctx.beginPath();
                    ctx.moveTo(i, 0);
                    ctx.lineTo(i + 200, 200);
                    ctx.stroke();
                }

                // Center circle
                ctx.beginPath();
                ctx.arc(100, 85, 40, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fill();

                // Camera icon (simple)
                ctx.fillStyle = textColor;
                ctx.font = 'bold 28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📷', 100, 85);

                // Label text
                ctx.fillStyle = textColor;
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(label, 100, 150);

                // Sub-label
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '10px Arial';
                ctx.fillText('DUMMY EVIDENCE', 100, 170);

                return canvas.toDataURL('image/jpeg', 0.8);
            };

            const photoResponse = generatePlaceholderImage('1. RESPONSE TIME', '#2563eb');
            const photoEngineerOnsite = generatePlaceholderImage('2. ENG ONSITE', '#7c3aed');
            const photoOnsite = generatePlaceholderImage('3. PRINC ONSITE', '#0891b2');
            const photoRestore = generatePlaceholderImage('4. RESTORE', '#059669');
            const photoResolution = generatePlaceholderImage('5. RESOLUTION', '#dc2626');
            const photoStandard = generatePlaceholderImage('EVIDENCE FOTO', '#ea580c');

            const dummySlaReport = {
                reportType: 'SLA',
                ticketName: 'Alarm WLD Air AC netes',
                location: 'Staging Room Bravo',
                priority: 'Medium',
                picDME: 'Ardian',
                picTDE: 'FMA - CBRE',
                remark: 'Team melaksanakan perbaikan corrective dengan melakukan cleaning drain pipe AC dan merapikan sensor WLD.',

                // Core calculations mapping
                issue: '[SLA / SLG] Alarm WLD Air AC netes (Medium)',
                actionTaken: 'Team melaksanakan perbaikan corrective dengan melakukan cleaning drain pipe AC dan merapikan sensor WLD.',
                status: 'Resolved',
                spareParts: '',
                quarter: 'Q2',
                year: '2026',

                // SLA 1: Response Time (comply)
                timeOrder: new Date(2026, 4, 15, 10, 0, 0).toISOString(),
                actualTimeResponse: new Date(2026, 4, 15, 10, 8, 0).toISOString(),
                actualResponseTimeMin: 8,
                targetResponseMin: 10,
                responseComply: true,
                photoResponse,

                // SLA 2: Engineer Onsite photo
                photoEngineerOnsite,

                // SLA 3: Onsite OPE (comply)
                actualTimeOnsite: new Date(2026, 4, 15, 11, 30, 0).toISOString(),
                actualOnsiteTimeMin: 90,
                targetOnsiteMin: 120,
                onsiteComply: true,
                photoOnsite,

                // SLA 4: Restore RST (comply)
                startOrder: new Date(2026, 4, 15, 10, 0, 0).toISOString(),
                finishOrder: new Date(2026, 4, 15, 12, 15, 0).toISOString(),
                actualRestoreTimeMin: 135,
                targetRestoreMin: 180,
                restoreComply: true,
                photoRestore,

                // SLA 5: Resolution RT (comply)
                actualResolutionTimeMin: 135,
                targetResolutionMin: 180,
                resolutionComply: true,
                photoResolution,

                // Metadata
                reportedBy: user.uid,
                reportedByEmail: user.email,
                reportedAt: serverTimestamp(),
            };

            const dummyStandardReport = {
                issue: 'Gate Bravo Pos Patah tertabrak mobil supplier',
                actionTaken: 'Team melakukan pengelasan besi engsel gate bravo agar bisa menutup normal.',
                spareParts: 'Engsel Pintu Besi, Kawat Las',
                status: 'Resolved',
                location: 'Gate Bravo luar',
                photoBase64: photoStandard,
                photoDescription: 'Gate bravo yang telah selesai dilas kembali.',
                quarter: 'Q2',
                year: '2026',
                category: 'Civil & Structure',
                reportedBy: user.uid,
                reportedByEmail: user.email,
                reportedAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'corrective_reports'), dummySlaReport);
            await addDoc(collection(db, 'corrective_reports'), dummyStandardReport);

            toast.success('Berhasil menambahkan 2 laporan dummy (1 SLA & 1 Standar)!', { id: 'seeding' });
        } catch (error) {
            console.error('Error seeding dummy data:', error);
            toast.error('Gagal menambahkan data dummy', { id: 'seeding' });
        }
    };

    const handleExportMonthlyPDF = async () => {
        if (filteredReports.length === 0) {
            toast.error('Tidak ada data laporan untuk diekspor!');
            return;
        }

        const monthLabel = selectedMonth === 'all' 
            ? 'Gabungan' 
            : INDO_MONTHS.find(m => m.value === selectedMonth)?.label || 'Bulan';
        const yearLabel = selectedYear === 'all' ? 'Gabungan' : selectedYear;

        toast.loading('Mengekspor PDF laporan bulanan...', { id: 'pdf-export' });
        try {
            await exportMonthlyPDF(filteredReports, monthLabel, yearLabel);
            toast.success('PDF Laporan Bulanan berhasil diunduh!', { id: 'pdf-export' });
        } catch (error) {
            console.error('Failed to export PDF:', error);
            toast.error('Gagal mengekspor PDF laporan bulanan', { id: 'pdf-export' });
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <PenTool className="w-6 h-6 text-orange-500" />
                        Corrective Maintenance
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Issue tracking and conflict resolution</p>
                </div>

                <div className="flex items-center gap-3">
                    {!readOnly && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={seedDummyData}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 shadow-lg cursor-pointer border border-slate-700/50 text-sm font-semibold"
                        >
                            <FileText className="w-4 h-4 text-orange-400" />
                            Isi Data Dummy
                        </motion.button>
                    )}

                    {canCreate && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                if (showForm) {
                                    setShowForm(false);
                                    setReportFormType(null);
                                } else {
                                    setShowForm(true);
                                    if (userRole === 'standby_engineer') {
                                        setReportFormType('sla');
                                    } else {
                                        setReportFormType(null); // Show selection screen
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer text-sm font-semibold animate-pulse hover:animate-none"
                        >
                            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {showForm ? 'Cancel' : 'New Report'}
                        </motion.button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showForm && canCreate && (
                    <div className="mb-8">
                        {reportFormType === null && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 text-center"
                            >
                                <h2 className="text-xl font-bold text-white mb-6">Pilih Jenis Laporan Corrective Maintenance</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
                                    <motion.button
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={() => setReportFormType('standard')}
                                        className="p-6 bg-slate-900/60 border border-slate-700/60 rounded-2xl hover:border-orange-500/50 hover:bg-slate-900 transition text-left flex flex-col items-center sm:items-start cursor-pointer"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500">
                                            <PenTool className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Laporan Standar</h3>
                                        <p className="text-slate-400 text-sm text-center sm:text-left">Format laporan maintenance standar dengan satu bukti foto dokumentasi cepat.</p>
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={() => setReportFormType('sla')}
                                        className="p-6 bg-slate-900/60 border border-slate-700/60 rounded-2xl hover:border-red-500/50 hover:bg-slate-900 transition text-left flex flex-col items-center sm:items-start cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="absolute top-3 right-3 bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                            Rekomendasi
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Laporan SLA / SLG (5-Step)</h3>
                                        <p className="text-slate-400 text-sm text-center sm:text-left">Wizard multi-step interaktif dengan kalkulasi otomatis durasi respon, kedatangan, restore, resolusi &amp; multi-bukti foto.</p>
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {reportFormType === 'standard' && (
                            <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                onSubmit={handleSubmit}
                                className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 overflow-hidden"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-white">
                                        {editingReportId ? 'Edit Laporan Corrective (Standard)' : 'New Corrective Report (Standard)'}
                                    </h2>
                                    {!editingReportId && (
                                        <button 
                                            type="button" 
                                            onClick={() => setReportFormType(null)} 
                                            className="text-xs font-bold text-orange-500 hover:text-orange-400 transition cursor-pointer"
                                        >
                                            &larr; Pilih Jenis Lapor Lain
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Location / Unit</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
                                                <input
                                                    required
                                                    type="text"
                                                    value={formData.location}
                                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                    placeholder="e.g. Server Room A, Unit Chiller 1"
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Issue Description</label>
                                            <textarea
                                                required
                                                value={formData.issue}
                                                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                                                placeholder="Describe the problem..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Action Taken</label>
                                            <textarea
                                                required
                                                value={formData.actionTaken}
                                                onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                                                placeholder="Describe the fix..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Status</label>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                                    title="Status"
                                                >
                                                    <option value="Open">Open</option>
                                                    <option value="InProgress">In Progress</option>
                                                    <option value="Resolved">Resolved</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Spare Parts (Opt)</label>
                                                <input
                                                    type="text"
                                                    value={formData.spareParts}
                                                    onChange={(e) => setFormData({ ...formData, spareParts: e.target.value })}
                                                    placeholder="e.g. Fan Belt, Fuse"
                                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Quarter *</label>
                                                <select
                                                    required
                                                    value={formData.quarter}
                                                    onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                                    title="Quarter"
                                                >
                                                    <option value="Q1">Q1</option>
                                                    <option value="Q2">Q2</option>
                                                    <option value="Q3">Q3</option>
                                                    <option value="Q4">Q4</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Year *</label>
                                                <select
                                                    required
                                                    value={formData.year}
                                                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                                    title="Year"
                                                >
                                                    <option value="2025">2025</option>
                                                    <option value="2026">2026</option>
                                                    <option value="2027">2027</option>
                                                    <option value="2028">2028</option>
                                                    <option value="2029">2029</option>
                                                    <option value="2030">2030</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Evidence Photo (Max 1)</label>
                                            <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-orange-500 transition cursor-pointer relative group">
                                                {formData.photoBase64 ? (
                                                    <div className="relative">
                                                        <img
                                                            src={formData.photoBase64}
                                                            alt="Evidence"
                                                            className="h-40 object-contain mx-auto rounded-lg"
                                                        />
                                                        <div className="absolute inset-0 bg-slate-950/20 opacity-100 transition rounded-lg flex items-center justify-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingPhoto(true)}
                                                                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xl cursor-pointer"
                                                                title="Edit / Crop Foto"
                                                            >
                                                                <Scissors className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, photoBase64: '' })}
                                                                className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-xl cursor-pointer"
                                                                title="Hapus Foto"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Camera className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                                        <p className="text-sm text-slate-400">Click to upload photo</p>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handlePhotoChange}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            title="Upload foto evidence"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Photo Description</label>
                                            <input
                                                type="text"
                                                value={formData.photoDescription}
                                                onChange={(e) => setFormData({ ...formData, photoDescription: e.target.value })}
                                                placeholder="What is in the photo?"
                                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3">
                                    {editingReportId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForm(false);
                                                setReportFormType(null);
                                                setEditingReportId(null);
                                            }}
                                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                        {editingReportId ? 'Simpan Laporan' : 'Submit Report'}
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {reportFormType === 'sla' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <SLAForm 
                                    editId={editingReportId || undefined}
                                    onSuccess={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                    onCancel={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                />
                            </motion.div>
                        )}
                    </div>
                )}
            </AnimatePresence>

            {!loading && (
                /* Glassmorphic Archive Filter & PDF Export Bar */
                <div className="mb-6 bg-slate-800/20 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                        {/* Live Search Input */}
                        <div className="relative flex-1 sm:flex-initial min-w-[240px]">
                            <input
                                type="text"
                                placeholder="Cari lokasi, masalah, PIC..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                title="Cari Laporan"
                                className="w-full pl-4 pr-4 py-2.5 bg-slate-900/40 border border-slate-700/80 rounded-xl text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition placeholder-slate-500"
                            />
                        </div>

                        {/* Month Filter Dropdown */}
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            title="Filter Bulan"
                            aria-label="Filter Bulan"
                            className="px-3.5 py-2.5 bg-slate-900/40 border border-slate-700/80 rounded-xl text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none transition cursor-pointer"
                        >
                            <option value="all">Semua Bulan</option>
                            {INDO_MONTHS.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>

                        {/* Year Filter Dropdown */}
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            title="Filter Tahun"
                            aria-label="Filter Tahun"
                            className="px-3.5 py-2.5 bg-slate-900/40 border border-slate-700/80 rounded-xl text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none transition cursor-pointer"
                        >
                            <option value="all">Semua Tahun</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2028">2028</option>
                            <option value="2029">2029</option>
                            <option value="2030">2030</option>
                        </select>
                    </div>

                    {/* Monthly PDF Export Trigger */}
                    {readOnly && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleExportMonthlyPDF}
                            disabled={filteredReports.length === 0}
                            className="w-full md:w-auto px-4.5 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:from-slate-800 disabled:to-slate-900 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition border border-rose-500/20"
                        >
                            <FileText className="w-4 h-4" />
                            Export PDF Bulanan ({filteredReports.length})
                        </motion.button>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/20 rounded-2xl border border-slate-700/50">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white">Laporan Tidak Ditemukan</h3>
                    <p className="text-slate-400 mt-2">Tidak ada data laporan corrective yang cocok dengan kriteria filter pencarian Anda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredReports.map((report) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-slate-800/20 backdrop-blur-sm rounded-2xl border overflow-hidden hover:border-slate-600 transition shadow-xl relative ${
                                report.reportType === 'SLA' ? 'border-red-500/30' : 'border-slate-700/50'
                            }`}
                        >
                            {report.reportType === 'SLA' ? (
                                /* SLA REPORT CARD LAYOUT */
                                <div className="p-5 sm:p-6">
                                    {/* Card Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/50 pb-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 uppercase tracking-wider">
                                                SLA / SLG
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{report.reportedAt?.toDate?.()?.toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <User className="w-3.5 h-3.5 text-slate-500" />
                                                <span>PIC: {report.picDME || 'On Duty DME'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <span className="text-[10px] px-2 py-0.5 bg-slate-700/40 border border-slate-600/30 rounded-md text-slate-300 font-semibold">
                                                    Dibuat: {report.reportedByEmail || '-'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={async () => {
                                                    const toastId = toast.loading('Mengunduh Laporan Excel...');
                                                    try {
                                                        await exportSLAReportToExcel(report);
                                                        toast.success('Berhasil mengunduh Laporan Excel!', { id: toastId });
                                                    } catch (err: any) {
                                                        console.error('Failed to export Excel:', err);
                                                        toast.error(`Gagal mengunduh Excel: ${err.message || err}`, { id: toastId });
                                                    }
                                                }}
                                                className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-lg shadow-emerald-500/5 cursor-pointer"
                                                title="Export to Excel"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Export Excel
                                            </button>
                                            {canCreate && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                <button
                                                    onClick={() => {
                                                        setEditingReportId(report.id);
                                                        setReportFormType('sla');
                                                        setShowForm(true);
                                                    }}
                                                    className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
                                                    title="Edit Laporan"
                                                >
                                                    <PenTool className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                <button
                                                    onClick={() => handleDeleteClick(report.id)}
                                                    className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                                                    title="Hapus Laporan"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Main Grid Info */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                        <div className="lg:col-span-2 space-y-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-white mb-1">{report.ticketName}</h3>
                                                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>{report.location}</span>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-slate-500">Prioritas:</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        report.priority === 'High' ? 'bg-rose-500/20 text-rose-400' :
                                                        report.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/30 text-slate-400'
                                                    }`}>{report.priority}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 border border-slate-700/30 rounded-xl p-4">
                                                <div>
                                                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Tindakan Perbaikan (Action)</span>
                                                    <p className="text-slate-300 text-sm leading-relaxed">{report.actionTaken}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Keterangan / Remarks</span>
                                                    <p className="text-slate-300 text-sm leading-relaxed">{report.remark || '-'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SLA Compliance Grid */}
                                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3">SLA Metrics Summary</h4>
                                            
                                            <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">1. Response Time</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-300">{report.actualResponseTimeMin} Min</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            report.responseComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}>{report.responseComply ? 'Comply' : 'No Comply'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">2. Engineer Onsite</span>
                                                    <span className="font-bold text-slate-300">Evidence Ok</span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">3. Principle Onsite</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-300">{report.actualOnsiteTimeMin} Min</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            report.onsiteComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}>{report.onsiteComply ? 'Comply' : 'No Comply'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">4. Restore Service</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-300">{report.actualRestoreTimeMin} Min</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            report.restoreComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}>{report.restoreComply ? 'Comply' : 'No Comply'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">5. Resolution Time</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-300">{report.actualResolutionTimeMin} Min</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            report.resolutionComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}>{report.resolutionComply ? 'Comply' : 'No Comply'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Multi-Screenshot Evidence Grid */}
                                    <div>
                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Bukti Dokumentasi SLA (5-Step)</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                            {report.photoResponse && (
                                                <div className="relative group border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/20">
                                                    <img src={report.photoResponse} alt="Response Time Evidence" className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">1. Response</span>
                                                    </div>
                                                </div>
                                            )}
                                            {report.photoEngineerOnsite && (
                                                <div className="relative group border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/20">
                                                    <img src={report.photoEngineerOnsite} alt="Engineer Onsite Evidence" className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">2. Eng Onsite</span>
                                                    </div>
                                                </div>
                                            )}
                                            {report.photoOnsite && (
                                                <div className="relative group border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/20">
                                                    <img src={report.photoOnsite} alt="Principle Onsite Evidence" className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">3. Princ Onsite</span>
                                                    </div>
                                                </div>
                                            )}
                                            {report.photoRestore && (
                                                <div className="relative group border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/20">
                                                    <img src={report.photoRestore} alt="Restore Time Evidence" className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">4. Restore</span>
                                                    </div>
                                                </div>
                                            )}
                                            {report.photoResolution && (
                                                <div className="relative group border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/20">
                                                    <img src={report.photoResolution} alt="Resolution Time Evidence" className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">5. Resolusi</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* STANDARD REPORT CARD LAYOUT */
                                <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6">
                                    {report.photoBase64 && (
                                        <div className="w-full md:w-64 flex-shrink-0">
                                            <img
                                                src={report.photoBase64}
                                                alt={report.photoDescription || 'Issue evidence'}
                                                className="w-full h-48 object-cover rounded-lg border border-slate-700"
                                            />
                                            {report.photoDescription && (
                                                <p className="text-xs text-slate-500 mt-2 text-center italic">{report.photoDescription}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                                            <div>
                                                <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(report.status)} mb-2`}>
                                                    {report.status}
                                                </div>
                                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-400" />
                                                    {report.location}
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Reported by <span className="text-slate-300">{report.reportedByEmail}</span> • {report.reportedAt?.toDate?.()?.toLocaleDateString()}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {canCreate && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingReportId(report.id);
                                                            setFormData({
                                                                issue: report.issue || '',
                                                                actionTaken: report.actionTaken || '',
                                                                spareParts: report.spareParts || '',
                                                                status: report.status || 'Open',
                                                                location: report.location || '',
                                                                photoBase64: report.photoBase64 || '',
                                                                photoDescription: report.photoDescription || '',
                                                                quarter: report.quarter || 'Q1',
                                                                year: report.year || new Date().getFullYear().toString(),
                                                            });
                                                            setReportFormType('standard');
                                                            setShowForm(true);
                                                        }}
                                                        className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
                                                        title="Edit Laporan"
                                                    >
                                                        <PenTool className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canDelete && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                    <button
                                                        onClick={() => handleDeleteClick(report.id)}
                                                        className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                                                        title="Hapus Laporan"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-sm font-semibold text-orange-400 mb-1 flex items-center gap-2">
                                                    <AlertCircle className="w-3 h-3" /> Issue
                                                </h4>
                                                <p className="text-slate-300 text-sm leading-relaxed">{report.issue}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-2">
                                                    <CheckCircle2 className="w-3 h-3" /> Action Taken
                                                </h4>
                                                <p className="text-slate-300 text-sm leading-relaxed">{report.actionTaken}</p>
                                            </div>
                                        </div>

                                        {report.spareParts && (
                                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spare Parts Used:</span>
                                                <span className="ml-2 text-sm text-slate-300">{report.spareParts}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {deleteId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Delete Report?</h3>
                                <p className="text-slate-400 mb-6">
                                    Are you sure you want to delete this maintenance report? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteId(null)}
                                        className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition cursor-pointer"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingPhoto && (
                    <ImageEditor
                        image={formData.photoBase64}
                        onSave={handleApplyEdit}
                        onCancel={() => setEditingPhoto(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
