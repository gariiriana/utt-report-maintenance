import { useState, useEffect, useRef } from 'react';
import { Bell, FileText, ChevronRight, X, Info, CheckCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { safeStorage } from '@/utils/safeStorage';

export interface AppNotificationItem {
    id: string;
    title: string;
    fileName: string;
    category: string;
    uploadedBy: string;
    uploadedAt: any;
    targetTab: 'documents' | 'files' | 'corrective_archive' | 'finding_archive' | 'ptw' | 'findings' | 'corrective';
    fileId?: string;
    searchQuery?: string;
    isRead?: boolean;
}

interface NotificationCenterProps {
    onSelectNotification: (item: AppNotificationItem) => void;
}

export function NotificationCenter({ onSelectNotification }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
    const [readIds, setReadIds] = useState<string[]>(() => {
        try {
            const saved = safeStorage.getItem('dwimitra_read_notifications');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync real-time uploads from Firestore (uploaded_files, corrective_reports, notifications)
    useEffect(() => {
        const notifItemsMap: { [id: string]: AppNotificationItem } = {};

        // 1. Listen to explicit notifications collection
        const qNotif = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(15));
        const unsubNotif = onSnapshot(qNotif, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                notifItemsMap[docSnap.id] = {
                    id: docSnap.id,
                    title: data.title || 'File Baru Diunggah',
                    fileName: data.fileName || 'Dokumen Maintenance',
                    category: data.category || 'Manajemen File',
                    uploadedBy: data.uploadedBy || 'User',
                    uploadedAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    targetTab: data.targetTab || 'files',
                    fileId: data.fileId || '',
                    searchQuery: data.searchQuery || data.fileName || ''
                };
            });
            updateState();
        });

        // 2. Listen to uploaded_files collection
        const qFiles = query(collection(db, 'uploaded_files'), orderBy('uploadedAt', 'desc'), limit(10));
        const unsubFiles = onSnapshot(qFiles, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `file_${docSnap.id}`;
                if (!notifItemsMap[notifId]) {
                    notifItemsMap[notifId] = {
                        id: notifId,
                        title: `File Upload: ${data.fileName || 'Dokumen Baru'}`,
                        fileName: data.fileName || 'File Dokumen',
                        category: data.category || 'Manajemen File',
                        uploadedBy: data.uploadedBy || 'Teknisi DME',
                        uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date(),
                        targetTab: 'files',
                        fileId: docSnap.id,
                        searchQuery: data.fileName || ''
                    };
                }
            });
            updateState();
        });

        // 3. Listen to corrective_reports collection
        const qCorrective = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'), limit(10));
        const unsubCorrective = onSnapshot(qCorrective, (snapshot) => {
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const notifId = `cm_${docSnap.id}`;
                const isSLA = data.reportType === 'SLA';
                const isPIR = data.reportType === 'PIR';
                const typeLabel = isSLA ? 'Laporan SLA' : isPIR ? 'Report PIR' : 'Laporan CM';
                const nameStr = data.incidentName || data.ticketName || data.issue || 'Corrective Maintenance';

                if (!notifItemsMap[notifId]) {
                    notifItemsMap[notifId] = {
                        id: notifId,
                        title: `${typeLabel} Baru: ${nameStr}`,
                        fileName: nameStr,
                        category: isSLA ? 'Form SLA/SLG' : isPIR ? 'Report PIR' : 'Report CM',
                        uploadedBy: data.reportedByEmail || 'Standby Engineer',
                        uploadedAt: data.reportedAt?.toDate ? data.reportedAt.toDate() : new Date(),
                        targetTab: 'corrective_archive',
                        fileId: docSnap.id,
                        searchQuery: nameStr
                    };
                }
            });
            updateState();
        });

        function updateState() {
            const list = Object.values(notifItemsMap).sort((a, b) => {
                const timeA = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : Date.now();
                const timeB = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : Date.now();
                return timeB - timeA;
            });
            setNotifications(list);
        }

        return () => {
            unsubNotif();
            unsubFiles();
            unsubCorrective();
        };
    }, []);

    // Count unread items
    const unreadCount = notifications.filter(item => !readIds.includes(item.id)).length;

    // Toggle popover & handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = (idStr: string) => {
        if (!readIds.includes(idStr)) {
            const updated = [...readIds, idStr];
            setReadIds(updated);
            safeStorage.setItem('dwimitra_read_notifications', JSON.stringify(updated));
        }
    };

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id);
        setReadIds(allIds);
        safeStorage.setItem('dwimitra_read_notifications', JSON.stringify(allIds));
    };

    const handleItemClick = (item: AppNotificationItem) => {
        markAsRead(item.id);
        setIsOpen(false);
        onSelectNotification(item);
    };

    const getCategoryBadgeColor = (category: string) => {
        if (category.includes('CM')) return 'bg-red-500/10 text-red-600 border-red-500/20';
        if (category.includes('SLA')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (category.includes('PIR')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center ${
                    isOpen
                        ? 'bg-red-50 text-red-600 border border-red-300 shadow-md ring-2 ring-red-400/40'
                        : unreadCount > 0
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 shadow-xs'
                }`}
                title="Notifikasi File & Laporan Baru"
            >
                <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 || isOpen ? 'text-red-600 animate-bounce' : 'text-slate-600'}`} />

                {/* RED BADGE NOTIFICATION DOT */}
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center rounded-full border-2 border-white shadow-md shadow-red-600/40 animate-pulse"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                    >
                        {/* Popover Header */}
                        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm leading-tight">Notifikasi File</h3>
                                    <p className="text-[10px] text-slate-500 font-medium">Update real-time upload file &amp; laporan</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                        title="Tandai semua dibaca"
                                    >
                                        <CheckCheck className="w-3 h-3" />
                                        Tandai Dibaca
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                                    title="Tutup"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Notification List */}
                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <p className="text-slate-500 text-xs font-semibold">Belum ada notifikasi file diunggah.</p>
                                </div>
                            ) : (
                                notifications.map((item) => {
                                    const isUnread = !readIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            className={`p-3.5 transition-colors cursor-pointer relative flex items-start gap-3 group ${
                                                isUnread ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            {/* Unread Indicator Pill */}
                                            {isUnread && (
                                                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-1.5 animate-pulse" />
                                            )}

                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                                isUnread ? 'bg-red-600 text-white border-red-500' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                <FileText className="w-4 h-4" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getCategoryBadgeColor(item.category)}`}>
                                                        {item.category}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {item.uploadedAt ? formatDistanceToNow(item.uploadedAt, { addSuffix: true, locale: id }) : 'Baru saja'}
                                                    </span>
                                                </div>

                                                <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-red-600 transition-colors">
                                                    {item.fileName}
                                                </h4>

                                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                    Pengunggah: <span className="font-semibold text-slate-700">{item.uploadedBy}</span>
                                                </p>

                                                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-blue-600 group-hover:underline">
                                                    <span>Buka file ini</span>
                                                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Popover Footer */}
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <Sparkles className="w-3 h-3 text-amber-500" /> Auto-sync aktif
                            </span>
                            <span className="font-semibold text-slate-400">Total: {notifications.length} file</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
