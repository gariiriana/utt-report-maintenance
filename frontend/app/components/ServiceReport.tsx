import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Upload,
    Search,
    Download,
    Trash2,
    X,
    Loader2,
    FolderOpen,
    CheckCircle,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    doc,
    serverTimestamp,
    getDocs,
    writeBatch,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

// File Categories - Updated with all required categories
const FILE_CATEGORIES = [
    'Laporan Harian',
    'Laporan Bulanan',
    'Checklist Alat',
    'Checklist APD',
    'PTW',
    'JSEA',
    'MOP',
    'SLA/SLG',
    'Custom',
    'Monthly'
];

// Maintenance Categories for Service Reports
const MAINTENANCE_TYPES = [
    'Water Leak',
    'Cooling Tower Water Treatment',
    'FCU',
    'Lift Units',
    'Dock Leveler',
    'Door',
    'Fuel Leak',
    'PJU',
    'Hydrant System',
    'Gate',
    'STP & Plumbing',
    'Exhaust Fan',
    'Capacitor Bank',
    'AHU',
    'UPS',
    'CRAC Data Hall & Supporting Room',
    'Chiller',
    'Cooling Tower',
    'ATS',
    'Cooling pump',
    'Transformer',
    'Generator & Fuel system',
    'MV and RMU panel',
    'LV Panel',
    'PDU Panel',
    'FSS',
    'Pre-Action System',
    'Lighting Point',
    'Grounding System',
    'Lightning Protection System',
    'VRV',
    'AC Splits',
    'Panel LDB & RDB (Distribution)',
    'Road Blocker',
    'X-Ray',
    'Pressurization & Degassing',
    'Pumps',
    'Water Softener',
    'Biosduct',
    'Physical Cooling Automation'
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];

// Allowed file types (PDF, Excel, Word)
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const CHUNK_SIZE = 800 * 1024;

interface ServiceReportData {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    category?: string; // NEW: 'Monthly' | 'Laporan Bulanan' | 'SLA/SLG'
    maintenanceType?: string; // Optional now
    quarter: string;
    year: string;
    uploadedBy: string;
    uploadedByEmail: string;
    uploadedAt: any;
    description?: string;
    totalChunks: number;
    status: 'uploading' | 'completed';
}

interface ServiceReportProps {
    initialNav?: { type: string; quarter: string; year: string } | null;
    onNavConsumed?: () => void;
}

export function ServiceReport({ initialNav, onNavConsumed }: ServiceReportProps) {
    const { user, userRole } = useAuth();
    const isAdmin = userRole === 'admin';
    const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';

    const [reports, setReports] = useState<ServiceReportData[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadMode, setUploadMode] = useState<'maintenance' | 'category'>('maintenance'); // NEW
    const [selectedCategory, setSelectedCategory] = useState(FILE_CATEGORIES[0]); // NEW
    const [selectedMaintenance, setSelectedMaintenance] = useState(MAINTENANCE_TYPES[0]);
    const [selectedQuarter, setSelectedQuarter] = useState('Q1');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [description, setDescription] = useState('');

    // Navigation & Filter state
    const [navPath, setNavPath] = useState<{
        type: string | null;
        quarter: string | null;
        maintenanceType: string | null;
    }>({ type: null, quarter: null, maintenanceType: null });

    const [categoryLastSeen, setCategoryLastSeen] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('service_report_last_seen_categories');
        return saved ? JSON.parse(saved) : {};
    });

    const markCategoryAsSeen = useCallback((categoryName: string) => {
        const now = Date.now();
        setCategoryLastSeen(prev => {
            const updated = { ...prev, [categoryName]: now };
            localStorage.setItem('service_report_last_seen_categories', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // ✅ NEW: Handle deep linking from notifications
    useEffect(() => {
        if (initialNav) {
            setNavPath({
                type: initialNav.type,
                quarter: initialNav.quarter,
                maintenanceType: null
            });
            setFilterYear(initialNav.year);
            // Mark as seen so the red badge disappears immediately
            markCategoryAsSeen(initialNav.type);
            markCategoryAsSeen(`${initialNav.type}_${initialNav.quarter}`);
            onNavConsumed?.();
        }
    }, [initialNav, onNavConsumed, markCategoryAsSeen]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterQuarter, setFilterQuarter] = useState('All');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

    // Modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<ServiceReportData | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');

    // Load data from Firestore
    useEffect(() => {
        const q = query(collection(db, 'service_reports'), orderBy('uploadedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ServiceReportData[];

            // Filter based on status and role-based visibility
            const filteredReports = reportsData.filter(r => {
                if (r.status !== 'completed') return false;

                // Admin sees everything
                if (isAdmin) return true;

                // TDE/CBRE visibility rules
                if (isTDEorCBRE) {
                    // Can see:
                    // 1. Reports with maintenanceType (Standard Service Reports)
                    // 2. Specific categories: 'Laporan Bulanan' or 'SLA/SLG'
                    const isVisibleCategory = r.category === 'Laporan Bulanan' || r.category === 'SLA/SLG';
                    return !!r.maintenanceType || isVisibleCategory;
                }

                // Default: standby_engineer or others might see only their own? 
                // Usually others see all approved reports unless restricted.
                return true;
            });

            setReports(filteredReports);
        });
        return () => unsubscribe();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > MAX_FILE_SIZE) {
                toast.error('File terlalu besar! Maksimal 30MB.');
                return;
            }
            if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                toast.error('Tipe file tidak didukung! Gunakan PDF, Excel, atau Word.');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) return;
        setUploading(true);
        setUploadProgress(0);

        try {
            const fileName = selectedFile.name;
            const fileReader = new FileReader();

            const fileDataPromise = new Promise<string>((resolve) => {
                fileReader.onload = (e) => resolve(e.target?.result as string);
                fileReader.readAsDataURL(selectedFile);
            });

            const base64Data = await fileDataPromise;
            const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
            const chunks: string[] = [];
            for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
                chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
            }

            // 1. Create document in service_reports
            const reportData: any = {
                fileName,
                fileSize: selectedFile.size,
                fileType: selectedFile.type,
                quarter: selectedQuarter,
                year: selectedYear,
                uploadedBy: user.uid,
                uploadedByEmail: user.email,
                uploadedAt: serverTimestamp(),
                description: description || null,
                totalChunks: totalChunks,
                status: 'uploading'
            };

            // Add either category or maintenanceType based on upload mode
            if (uploadMode === 'category') {
                reportData.category = selectedCategory;
                // For MOP, JSEA, and PTW, we also save the maintenanceType
                if (['MOP', 'JSEA', 'PTW'].includes(selectedCategory)) {
                    reportData.maintenanceType = selectedMaintenance;
                } else {
                    reportData.maintenanceType = null;
                }
            } else {
                reportData.category = null;
                reportData.maintenanceType = selectedMaintenance;
            }

            const reportDocRef = await addDoc(collection(db, 'service_reports'), reportData);

            // 2. Upload chunks to sub-collection
            const batchSize = 10;
            for (let i = 0; i < totalChunks; i += batchSize) {
                const batch = writeBatch(db);
                const currentBatchChunks = chunks.slice(i, i + batchSize);

                currentBatchChunks.forEach((chunkData, index) => {
                    const chunkIndex = i + index;
                    const chunkRef = doc(collection(db, 'service_reports', reportDocRef.id, 'chunks'), chunkIndex.toString());
                    batch.set(chunkRef, { index: chunkIndex, data: chunkData });
                });

                await batch.commit();
                setUploadProgress(Math.min(((i + batchSize) / totalChunks) * 100, 99));
            }

            // 3. Mark as completed
            const finalBatch = writeBatch(db);
            finalBatch.update(doc(db, 'service_reports', reportDocRef.id), { status: 'completed' });
            await finalBatch.commit();

            setUploadProgress(100);
            setUploadedFileName(fileName);
            setShowSuccessModal(true);

            // Reset
            setSelectedFile(null);
            setDescription('');
            setUploading(false);
            toast.success('Service Report berhasil diunggah!');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Gagal mengunggah file.');
            setUploading(false);
        }
    };

    const handleDownload = async (report: ServiceReportData) => {
        try {
            toast.loading('Menyiapkan file...', { id: 'download' });
            const chunksSnapshot = await getDocs(query(collection(db, 'service_reports', report.id, 'chunks'), orderBy('index')));
            const combinedData = chunksSnapshot.docs.map(doc => doc.data().data).join('');

            const link = document.createElement('a');
            link.href = combinedData;
            link.download = report.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('File berhasil diunduh!', { id: 'download' });
        } catch (error) {
            toast.error('Gagal mengunduh file.', { id: 'download' });
        }
    };

    const handleDelete = async () => {
        if (!reportToDelete || !isAdmin) return;
        setIsBulkDeleting(true);
        try {
            const batch = writeBatch(db);
            const chunksSnapshot = await getDocs(collection(db, 'service_reports', reportToDelete.id, 'chunks'));
            chunksSnapshot.forEach(chunkDoc => batch.delete(chunkDoc.ref));
            batch.delete(doc(db, 'service_reports', reportToDelete.id));
            await batch.commit();

            toast.success('Laporan berhasil dihapus');
            setDeleteModalOpen(false);
            setReportToDelete(null);
        } catch (error) {
            toast.error('Gagal menghapus laporan');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Filter Logic
    const filteredReports = reports.filter(report => {
        const matchesSearch = report.fileName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesQuarterFilter = filterQuarter === 'All' || report.quarter === filterQuarter;
        const matchesYearFilter = filterYear === 'All' || report.year === filterYear;
        // Match either maintenanceType OR category based on current navPath.type
        const matchesTypeOrCategory = !navPath.type ||
            report.maintenanceType === navPath.type ||
            report.category === navPath.type;
        const matchesNavQuarter = !navPath.quarter || report.quarter === navPath.quarter;
        const matchesNavMaintenanceType = !navPath.maintenanceType || report.maintenanceType === navPath.maintenanceType;

        return matchesSearch && matchesQuarterFilter && matchesYearFilter && matchesTypeOrCategory && matchesNavQuarter && matchesNavMaintenanceType;
    });


    const maintenanceSummary = MAINTENANCE_TYPES.map(type => {
        const categoryReports = reports.filter(r => r.maintenanceType === type);
        const count = categoryReports.filter(r =>
            (filterYear === 'All' || r.year === filterYear) &&
            (filterQuarter === 'All' || r.quarter === filterQuarter)
        ).length;
        const lastSeenTime = categoryLastSeen[type] || 0;
        const hasNew = (isTDEorCBRE || isAdmin) && categoryReports.some(r => (r.uploadedAt?.toMillis() || 0) > lastSeenTime);

        return {
            name: type,
            count,
            hasNew
        };
    }).filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const isFiltering = filterYear !== 'All' || filterQuarter !== 'All' || searchQuery !== '';
        // Admins and standby engineers see all folders (even empty ones)
        // TDE/CBRE see maintenance folders if they matches their visibility (already handled in reports fetching)
        const hasContent = item.count > 0 || ((isAdmin || userRole === 'standby_engineer') && !isFiltering);
        return matchesSearch && hasContent;
    });

    // ✅ NEW: Category Summary (Laporan Bulanan, SLA/SLG, etc.)
    const categorySummary = FILE_CATEGORIES.map(cat => {
        const catReports = reports.filter(r => r.category === cat);
        const count = catReports.filter(r =>
            (filterYear === 'All' || r.year === filterYear) &&
            (filterQuarter === 'All' || r.quarter === filterQuarter)
        ).length;
        const lastSeenTime = categoryLastSeen[cat] || 0;
        const hasNew = (isTDEorCBRE || isAdmin) && catReports.some(r => (r.uploadedAt?.toMillis() || 0) > lastSeenTime);

        return {
            name: cat,
            count,
            hasNew
        };
    }).filter(item => {
        // TDE/CBRE Role Restrictions: Hide 'Monthly' from them
        if (isTDEorCBRE && item.name === 'Monthly') return false;

        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const isFiltering = filterYear !== 'All' || filterQuarter !== 'All' || searchQuery !== '';
        const hasContent = item.count > 0 || ((isAdmin || isTDEorCBRE) && !isFiltering);
        return matchesSearch && hasContent;
    });

    const quarterSummary = QUARTERS.map(q => {
        const categoryQuarterReports = reports.filter(r =>
            (r.maintenanceType === navPath.type || r.category === navPath.type) &&
            r.quarter === q
        );
        const count = categoryQuarterReports.filter(r => filterYear === 'All' || r.year === filterYear).length;
        const lastSeenTime = categoryLastSeen[`${navPath.type}_${q}`] || categoryLastSeen[navPath.type || ''] || 0;
        // Note: Fallback to category last seen for quarters if not specifically set
        const hasNew = (isTDEorCBRE || isAdmin) && categoryQuarterReports.some(r => (r.uploadedAt?.toMillis() || 0) > lastSeenTime);

        return {
            name: q,
            count,
            hasNew
        };
    }).filter(item => {
        const matchesSearch = `Kuartal ${item.name}`.toLowerCase().includes(searchQuery.toLowerCase());
        // Patuhi filter kuartal dari top bar juga
        const isQuarterFiltered = filterQuarter !== 'All' && item.name !== filterQuarter;
        const isYearFiltered = filterYear !== 'All' || searchQuery !== '';
        const hasContent = (item.count > 0 || ((isAdmin || isTDEorCBRE) && !isYearFiltered)) && !isQuarterFiltered;
        return matchesSearch && hasContent;
    });

    // ✅ NEW: Maintenance Type Summary inside Quarter Folder
    const isSpecialCategory = ['MOP', 'JSEA', 'PTW'].includes(navPath.type || '');
    const maintenanceTypeSummary = MAINTENANCE_TYPES.map(type => {
        const typeReports = reports.filter(r =>
            r.category === navPath.type &&
            r.quarter === navPath.quarter &&
            r.maintenanceType === type
        );
        const count = typeReports.filter(r => filterYear === 'All' || r.year === filterYear).length;
        const lastSeenKey = `${navPath.type}_${navPath.quarter}_${type}`;
        const lastSeenTime = categoryLastSeen[lastSeenKey] || 0;
        const hasNew = (isTDEorCBRE || isAdmin) && typeReports.some(r => (r.uploadedAt?.toMillis() || 0) > lastSeenTime);

        return {
            name: type,
            count,
            hasNew
        };
    }).filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        // Only show types that have files, or show all for Admin/TDE/CBRE
        const isFilteringMType = searchQuery !== '';
        const hasContent = item.count > 0 || ((isAdmin || isTDEorCBRE) && !isFilteringMType);
        return matchesSearch && hasContent;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Service Reports</h2>
                    <p className="text-slate-400 mt-1">Laporan servis perangkat yang sudah disetujui (Approved).</p>
                </div>
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-4 max-w-2xl w-full">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Cari nama file..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-sm"
                        />
                    </div>
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-2xl px-6 py-3 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none backdrop-blur-sm transition-all cursor-pointer hover:bg-slate-800/50"
                    >
                        <option value="All">Semua Tahun</option>
                        {YEARS.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <select
                        value={filterQuarter}
                        onChange={(e) => setFilterQuarter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-2xl px-6 py-3 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none backdrop-blur-sm transition-all cursor-pointer hover:bg-slate-800/50"
                    >
                        <option value="All">Semua Kuartal</option>
                        {QUARTERS.map(q => (
                            <option key={q} value={q}>{q}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Admin Upload Section */}
            {isAdmin && !navPath.type && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-blue-600/10" />
                    <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                        {/* File Dropzone */}
                        <div className="flex-1 space-y-4">
                            <label className="block text-sm font-medium text-slate-300">Unggah Laporan Baru (Approved)</label>
                            <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${selectedFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-blue-500/50 bg-slate-900/40'}`}>
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                                />
                                <div className="text-center space-y-3">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto transition-colors ${selectedFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                        <Upload className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-slate-200 font-medium">{selectedFile ? selectedFile.name : 'Pilih File (Approved Report)'}</p>
                                        <p className="text-xs text-slate-500 mt-1">PDF, Excel, Word - Maks 30MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metadata Form */}
                        <div className="lg:w-96 space-y-6">
                            {/* Upload Mode Toggle */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('maintenance')}
                                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${uploadMode === 'maintenance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        Maintenance Type
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('category')}
                                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${uploadMode === 'category' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        File Category
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Conditional: Maintenance Type OR Category */}
                                {uploadMode === 'maintenance' ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Maintenance</label>
                                        <select
                                            value={selectedMaintenance}
                                            onChange={(e) => setSelectedMaintenance(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        >
                                            {MAINTENANCE_TYPES.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                            >
                                                {FILE_CATEGORIES.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Conditional Maintenance Selection for specific categories */}
                                        {['MOP', 'JSEA', 'PTW'].includes(selectedCategory) && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="space-y-2"
                                            >
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Maintenance</label>
                                                <select
                                                    value={selectedMaintenance}
                                                    onChange={(e) => setSelectedMaintenance(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                                >
                                                    {MAINTENANCE_TYPES.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </motion.div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quarter</label>
                                    <select
                                        value={selectedQuarter}
                                        onChange={(e) => setSelectedQuarter(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    >
                                        {QUARTERS.map(q => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    >
                                        {YEARS.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Keterangan (Opsional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tambahkan detail..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-300 h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Mengunggah {Math.round(uploadProgress)}%</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        <span>Upload Approved Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Navigation & Browser */}
            <div className="space-y-6">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-3 text-sm overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setNavPath({ type: null, quarter: null, maintenanceType: null })}
                        className={`px-4 py-2 rounded-xl transition-all ${!navPath.type ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'}`}
                    >
                        Semua Kategori
                    </button>
                    {navPath.type && (
                        <>
                            <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                            <button
                                onClick={() => setNavPath(prev => ({ ...prev, quarter: null }))}
                                className={`px-4 py-2 rounded-xl transition-all ${navPath.type && !navPath.quarter ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'} whitespace-nowrap`}
                            >
                                {navPath.type}
                            </button>
                        </>
                    )}
                    {navPath.quarter && (
                        <>
                            <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                            <button
                                onClick={() => setNavPath(prev => ({ ...prev, maintenanceType: null }))}
                                className={`px-4 py-2 rounded-xl transition-all ${navPath.quarter && !navPath.maintenanceType ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'} whitespace-nowrap`}
                            >
                                {navPath.quarter}
                            </button>
                        </>
                    )}
                    {navPath.maintenanceType && (
                        <>
                            <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                            <span className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow-lg whitespace-nowrap">
                                {navPath.maintenanceType}
                            </span>
                        </>
                    )}

                    {/* Back Button */}
                    {(navPath.type || navPath.quarter || navPath.maintenanceType) && (
                        <button
                            onClick={() => {
                                if (navPath.maintenanceType) setNavPath(prev => ({ ...prev, maintenanceType: null }));
                                else if (navPath.quarter) setNavPath(prev => ({ ...prev, quarter: null }));
                                else setNavPath({ type: null, quarter: null, maintenanceType: null });
                            }}
                            className="ml-auto flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                        >
                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                            <span>Kembali</span>
                        </button>
                    )}
                </div>

                {/* Sub-Folders / Files View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {!navPath.type ? (
                        // Folders View
                        <>
                            {/* File Categories Section */}
                            {categorySummary.length > 0 && (
                                <div className="col-span-full mb-2">
                                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Kategori Laporan</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {categorySummary.map(item => (
                                            <motion.button
                                                key={item.name}
                                                layoutId={`folder-${item.name}`}
                                                onClick={() => {
                                                    setNavPath({ type: item.name, quarter: null, maintenanceType: null });
                                                    markCategoryAsSeen(item.name);
                                                }}
                                                className="group relative bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/10"
                                            >
                                                {item.hasNew && (
                                                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/40 animate-pulse border-2 border-slate-900 z-10">
                                                        NEW
                                                    </div>
                                                )}
                                                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                                                    <FolderOpen className="w-7 h-7 text-emerald-400" />
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight mb-2">{item.name}</h3>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-emerald-500/70 font-medium">{item.count} Laporan</span>
                                                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Maintenance Types Section */}
                            <div className="col-span-full mt-4 mb-2">
                                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Maintenance Reports</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {maintenanceSummary.map(item => (
                                        <motion.button
                                            key={item.name}
                                            layoutId={`folder-${item.name}`}
                                            onClick={() => {
                                                setNavPath({ type: item.name, quarter: null, maintenanceType: null });
                                                markCategoryAsSeen(item.name);
                                            }}
                                            className="group relative bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10"
                                        >
                                            {item.hasNew && (
                                                <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/40 animate-pulse border-2 border-slate-900 z-10">
                                                    NEW
                                                </div>
                                            )}
                                            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                                                <FolderOpen className="w-7 h-7 text-blue-400" />
                                            </div>
                                            <h3 className="text-white font-bold text-lg leading-tight mb-2">{item.name}</h3>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-500">{item.count} Laporan</span>
                                                <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : !navPath.quarter ? (
                        // Quarter Folders View
                        quarterSummary.map(item => (
                            <motion.button
                                key={item.name}
                                layoutId={`quarter-${item.name}`}
                                onClick={() => {
                                    setNavPath(prev => ({ ...prev, quarter: item.name }));
                                    markCategoryAsSeen(`${navPath.type}_${item.name}`);
                                }}
                                className="group relative bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/10"
                            >
                                {item.hasNew && (
                                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/40 animate-pulse border-2 border-slate-900 z-10">
                                        NEW
                                    </div>
                                )}
                                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                                    <FolderOpen className="w-7 h-7 text-emerald-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Kuartal {item.name}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">{item.count} File</span>
                                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                                </div>
                            </motion.button>
                        ))
                    ) : (isSpecialCategory && !navPath.maintenanceType) ? (
                        // Maintenance Type Folders View (Inside Quarter for MOP/JSEA/PTW)
                        maintenanceTypeSummary.map(item => (
                            <motion.button
                                key={item.name}
                                layoutId={`mtype-${item.name}`}
                                onClick={() => {
                                    setNavPath(prev => ({ ...prev, maintenanceType: item.name }));
                                    markCategoryAsSeen(`${navPath.type}_${navPath.quarter}_${item.name}`);
                                }}
                                className="group relative bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10"
                            >
                                {item.hasNew && (
                                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/40 animate-pulse border-2 border-slate-900 z-10">
                                        NEW
                                    </div>
                                )}
                                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                                    <FolderOpen className="w-7 h-7 text-blue-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">{item.name}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">{item.count} Laporan</span>
                                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </motion.button>
                        ))
                    ) : (
                        // Files View
                        <div className="col-span-full space-y-4">
                            {filteredReports.length === 0 ? (
                                <div className="py-20 text-center">
                                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <X className="w-10 h-10 text-slate-600" />
                                    </div>
                                    <p className="text-slate-400 text-lg">Belum ada laporan di periode ini.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredReports.map(report => (
                                        <motion.div
                                            key={report.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-blue-500/30 transition-all hover:shadow-lg backdrop-blur-sm"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-slate-200 font-semibold truncate group-hover:text-blue-400 transition-colors">{report.fileName}</h4>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">{(report.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                                        <span className="text-[10px] text-slate-500">{new Date(report.uploadedAt?.seconds * 1000).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {report.description && (
                                                <p className="mt-4 text-xs text-slate-500 line-clamp-2 italic">"{report.description}"</p>
                                            )}
                                            <div className="mt-5 flex gap-2">
                                                <button
                                                    onClick={() => handleDownload(report)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900/50 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all font-medium text-sm"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => { setReportToDelete(report); setDeleteModalOpen(true); }}
                                                        className="w-11 flex items-center justify-center bg-slate-900/50 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-xl border border-slate-700 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
                        onClick={() => setShowSuccessModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full border border-slate-700 text-center shadow-2xl relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                                </motion.div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Approved Report Berhasil!</h3>
                            <p className="text-slate-400 mb-6 px-4 text-sm">
                                File <span className="text-emerald-400 font-medium break-all">{uploadedFileName}</span> telah disimpan sebagai laporan resmi.
                            </p>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all"
                            >
                                Selesai
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl"
                        >
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Hapus Laporan?</h3>
                            <p className="text-slate-400 text-sm mb-6">Tindakan ini permanen. File <span className="text-white italic">{reportToDelete?.fileName}</span> akan dihapus dari sistem.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600">Batal</button>
                                <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-500 flex items-center justify-center gap-2">
                                    {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Hapus'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
