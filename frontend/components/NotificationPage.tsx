import { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, 
    Search, 
    FileText, 
    Filter, 
    RefreshCw, 
    Clock, 
    ChevronRight,
    SlidersHorizontal,
    X,
    FolderArchive
} from 'lucide-react';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    onSnapshot 
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { AppNotificationItem } from '@/components/NotificationCenter';
import { toast } from 'sonner';

interface NotificationPageProps {
    onSelectNotification: (item: AppNotificationItem) => void;
}

export function NotificationPage({ onSelectNotification }: NotificationPageProps) {
    const [allNotifications, setAllNotifications] = useState<AppNotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [presetRange, setPresetRange] = useState<'all' | 'today' | '7days' | '30days' | 'thisMonth'>('all');

    // Real-time synchronization across multiple collections
    useEffect(() => {
        setLoading(true);
        const itemsMap: { [id: string]: AppNotificationItem } = {};

        // 1. Explicit notifications collection
        const qNotif = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(150));
        const unsubNotif = onSnapshot(qNotif, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                itemsMap[`notif_${docSnap.id}`] = {
                    id: docSnap.id,
                    title: data.title || 'File Baru Diunggah',
                    fileName: data.fileName || 'Dokumen Maintenance',
                    category: data.category || 'Manajemen File',
                    uploadedBy: data.uploadedBy || 'User',
                    uploadedAt: dateObj,
                    targetTab: data.targetTab || 'files',
                    fileId: data.fileId || '',
                    searchQuery: data.searchQuery || data.fileName || ''
                };
            });
            updateList();
        });

        // 2. uploaded_files collection
        const qFiles = query(collection(db, 'uploaded_files'), orderBy('uploadedAt', 'desc'), limit(150));
        const unsubFiles = onSnapshot(qFiles, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `file_${docSnap.id}`;
                if (!itemsMap[notifId]) {
                    const dateObj = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date();
                    itemsMap[notifId] = {
                        id: notifId,
                        title: `File Upload: ${data.fileName || 'Dokumen Baru'}`,
                        fileName: data.fileName || 'File Dokumen',
                        category: data.category || 'Manajemen File',
                        uploadedBy: data.uploadedByEmail || data.uploadedBy || 'Teknisi DME',
                        uploadedAt: dateObj,
                        targetTab: 'files',
                        fileId: docSnap.id,
                        searchQuery: data.fileName || ''
                    };
                }
            });
            updateList();
        });

        // 3. pdf_documents collection (Dokumentasi Maintenance)
        const qPdfDocs = query(collection(db, 'pdf_documents'), orderBy('createdAt', 'desc'), limit(150));
        const unsubPdfDocs = onSnapshot(qPdfDocs, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `pdfdoc_${docSnap.id}`;
                if (!itemsMap[notifId]) {
                    const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : (data.date ? new Date(data.date) : new Date());
                    const mName = data.maintenanceName || data.equipmentName || data.system || data.maintenanceType || '';
                    const displayFileName = (data.fileName && data.fileName !== 'Service Report.pdf') 
                        ? data.fileName 
                        : (mName ? `Dokumentasi Maintenance ${mName}.pdf` : 'Dokumentasi Maintenance.pdf');
                    const displayTitle = mName ? `Dokumentasi Maintenance ${mName}` : (data.fileName || 'Dokumentasi Maintenance');
                    const uploaderEmail = data.createdBy || data.uploadedByEmail || data.uploadedBy || data.author || 'Teknisi DME';

                    itemsMap[notifId] = {
                        id: notifId,
                        title: displayTitle,
                        fileName: displayFileName,
                        category: 'Arsip Dokumen',
                        uploadedBy: uploaderEmail,
                        uploadedAt: dateObj,
                        targetTab: 'documents',
                        fileId: docSnap.id,
                        searchQuery: displayFileName || mName
                    };
                }
            });
            updateList();
        });

        // 4. corrective_reports collection (CM, PIR, SLA)
        const qCorrective = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'), limit(150));
        const unsubCorrective = onSnapshot(qCorrective, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `cm_${docSnap.id}`;
                const isSLA = data.reportType === 'SLA';
                const isPIR = data.reportType === 'PIR';
                const typeLabel = isSLA ? 'Laporan SLA' : isPIR ? 'Report PIR' : 'Laporan CM';
                const nameStr = data.incidentName || data.ticketName || data.issue || 'Corrective Maintenance';

                if (!itemsMap[notifId]) {
                    const dateObj = data.reportedAt?.toDate ? data.reportedAt.toDate() : new Date();
                    itemsMap[notifId] = {
                        id: notifId,
                        title: `${typeLabel} Baru: ${nameStr}`,
                        fileName: nameStr,
                        category: isSLA ? 'Form SLA/SLG' : isPIR ? 'Report PIR' : 'Report CM',
                        uploadedBy: data.reportedByEmail || 'Standby Engineer',
                        uploadedAt: dateObj,
                        targetTab: 'corrective_archive',
                        fileId: docSnap.id,
                        searchQuery: nameStr
                    };
                }
            });
            updateList();
        });

        // 5. ptw_records collection
        const qPtw = query(collection(db, 'ptw_records'), orderBy('createdAt', 'desc'), limit(100));
        const unsubPtw = onSnapshot(qPtw, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `ptw_${docSnap.id}`;
                if (!itemsMap[notifId]) {
                    const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                    const titleStr = data.workTitle || data.sequenceNumber || 'Izin Kerja PTW';
                    itemsMap[notifId] = {
                        id: notifId,
                        title: `Dokumen PTW: ${titleStr}`,
                        fileName: `PTW_${titleStr}`,
                        category: 'PTW',
                        uploadedBy: data.contractorName || data.applicantEmail || 'Vendor / Engineer',
                        uploadedAt: dateObj,
                        targetTab: 'ptw',
                        fileId: docSnap.id,
                        searchQuery: titleStr
                    };
                }
            });
            updateList();
        });

        function updateList() {
            const list = Object.values(itemsMap).sort((a, b) => {
                const timeA = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : 0;
                const timeB = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : 0;
                return timeB - timeA;
            });
            setAllNotifications(list);
            setLoading(false);
        }

        return () => {
            unsubNotif();
            unsubFiles();
            unsubPdfDocs();
            unsubCorrective();
            unsubPtw();
        };
    }, []);

    // Handle Quick Date Presets
    const handlePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'thisMonth') => {
        setPresetRange(preset);
        const today = new Date();

        if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        } else if (preset === 'today') {
            const str = format(today, 'yyyy-MM-dd');
            setStartDate(str);
            setEndDate(str);
        } else if (preset === '7days') {
            const start = subDays(today, 6);
            setStartDate(format(start, 'yyyy-MM-dd'));
            setEndDate(format(today, 'yyyy-MM-dd'));
        } else if (preset === '30days') {
            const start = subDays(today, 29);
            setStartDate(format(start, 'yyyy-MM-dd'));
            setEndDate(format(today, 'yyyy-MM-dd'));
        } else if (preset === 'thisMonth') {
            const start = startOfMonth(today);
            const end = endOfMonth(today);
            setStartDate(format(start, 'yyyy-MM-dd'));
            setEndDate(format(end, 'yyyy-MM-dd'));
        }
    };

    // Filter Logic
    const filteredNotifications = useMemo(() => {
        return allNotifications.filter(item => {
            // 1. Date Range Filter
            if (startDate || endDate) {
                const itemDate = item.uploadedAt instanceof Date ? item.uploadedAt : new Date();
                
                if (startDate && endDate) {
                    const start = startOfDay(parseISO(startDate));
                    const end = endOfDay(parseISO(endDate));
                    if (!isWithinInterval(itemDate, { start, end })) return false;
                } else if (startDate) {
                    const start = startOfDay(parseISO(startDate));
                    if (itemDate < start) return false;
                } else if (endDate) {
                    const end = endOfDay(parseISO(endDate));
                    if (itemDate > end) return false;
                }
            }

            // 2. Category Filter
            if (categoryFilter !== 'Semua') {
                if (categoryFilter === 'Arsip Dokumen' && !item.category.includes('Arsip Dokumen') && !item.category.includes('Service')) return false;
                if (categoryFilter === 'Manajemen File' && !item.category.includes('Manajemen File') && item.category.includes('Arsip')) return false;
                if (categoryFilter === 'Corrective' && !item.category.includes('CM') && !item.category.includes('PIR') && !item.category.includes('SLA')) return false;
                if (categoryFilter === 'PTW' && !item.category.includes('PTW')) return false;
            }

            // 3. Search Query Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.fileName.toLowerCase().includes(q);
                const matchTitle = item.title.toLowerCase().includes(q);
                const matchUser = item.uploadedBy.toLowerCase().includes(q);
                const matchCat = item.category.toLowerCase().includes(q);
                if (!matchName && !matchTitle && !matchUser && !matchCat) return false;
            }

            return true;
        });
    }, [allNotifications, startDate, endDate, categoryFilter, searchQuery]);

    const categoriesList = ['Semua', 'Arsip Dokumen', 'Manajemen File', 'Corrective', 'PTW'];

    const getCategoryBadge = (category: string) => {
        if (category.includes('CM')) return 'bg-red-50 text-red-700 border-red-200';
        if (category.includes('SLA')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (category.includes('PIR')) return 'bg-amber-50 text-amber-800 border-amber-200';
        if (category.includes('PTW')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        if (category.includes('Arsip')) return 'bg-blue-50 text-blue-700 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10 space-y-4 sm:space-y-6">
            
            {/* Header & Filter Card - Natural App Design */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-sky-100/90 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h1 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                            <FolderArchive className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            Riwayat Input File &amp; Notifikasi
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                            Audit real-time seluruh berkas, laporan maintenance, dan dokumen yang diunggah berdasarkan rentang tanggal.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setCategoryFilter('Semua');
                            setSearchQuery('');
                            setPresetRange('all');
                            toast.success('Filter direset');
                        }}
                        className="self-start sm:self-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer active:scale-95"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset Filter
                    </button>
                </div>

                {/* Filter Controls Grid */}
                <div className="space-y-3">
                    {/* Preset Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-blue-600" /> Pilih Periode:
                        </span>
                        <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-medium">
                            {(['all', 'today', '7days', '30days', 'thisMonth'] as const).map((p) => {
                                const labels = {
                                    all: 'Semua Waktu',
                                    today: 'Hari Ini',
                                    '7days': '7 Hari Terakhir',
                                    '30days': '30 Hari Terakhir',
                                    thisMonth: 'Bulan Ini'
                                };
                                return (
                                    <button
                                        key={p}
                                        onClick={() => handlePresetChange(p)}
                                        className={`px-3 py-1.5 rounded-lg transition text-xs font-bold cursor-pointer ${
                                            presetRange === p
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {labels[p]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Inputs Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari file, judul, email..."
                                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition placeholder-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Date Range Inputs */}
                        <div className="flex gap-2 items-center col-span-1 sm:col-span-2">
                            <div className="relative flex-1">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setPresetRange('all');
                                    }}
                                    className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition text-slate-900 text-xs font-medium"
                                    title="Dari tanggal"
                                />
                            </div>
                            <span className="text-slate-400 text-xs font-semibold">s/d</span>
                            <div className="relative flex-1">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setPresetRange('all');
                                    }}
                                    className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition text-slate-900 text-xs font-medium"
                                    title="Sampai tanggal"
                                />
                            </div>
                        </div>

                        {/* Category Dropdown */}
                        <div className="relative">
                            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
                            >
                                {categoriesList.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>



            {/* Results Table - Matching DocumentList Clean Table */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        Daftar Berkas &amp; Laporan Masuk ({filteredNotifications.length})
                    </h3>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-500 space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                        <p className="text-xs font-semibold">Memuat riwayat input file...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 space-y-2">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">Tidak ada file ditemukan pada filter ini.</p>
                        <p className="text-[11px] text-slate-400">Coba ubah tanggal atau kata kunci pencarian.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    <th className="py-3 px-4">Waktu Upload</th>
                                    <th className="py-3 px-4">Kategori</th>
                                    <th className="py-3 px-4">Nama File / Judul Laporan</th>
                                    <th className="py-3 px-4">Pengunggah</th>
                                    <th className="py-3 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredNotifications.map((item) => {
                                    const dateObj = item.uploadedAt instanceof Date ? item.uploadedAt : new Date();
                                    const timeFormatted = format(dateObj, 'dd MMM yyyy, HH:mm', { locale: id });

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                                {timeFormatted}
                                            </td>

                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadge(item.category)}`}>
                                                    {item.category}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-600 transition-colors max-w-xs truncate">
                                                {item.fileName}
                                            </td>

                                            <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                                                <span className="truncate max-w-[180px] inline-block">{item.uploadedBy}</span>
                                            </td>

                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => onSelectNotification(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-bold transition border border-blue-200 cursor-pointer active:scale-95"
                                                >
                                                    <span>Buka File</span>
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
