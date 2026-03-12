import { useState, useEffect, useRef } from 'react';
import { Bell, FileText, ChevronRight, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { safeStorage } from '@/lib/safeStorage';

interface NotificationItem {
    id: string;
    fileName: string;
    maintenanceType: string;
    quarter: string;
    year: string;
    uploadedAt: Timestamp;
}

interface NotificationCenterProps {
    onNotificationClick: (type: string, quarter: string, year: string) => void;
}

export function NotificationCenter({ onNotificationClick }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial load for last seen timestamp
    const [lastSeen, setLastSeen] = useState<number>(() => {
        const saved = safeStorage.getItem('service_report_last_seen');
        return saved ? parseInt(saved) : Date.now();
    });

    useEffect(() => {
        const q = query(
            collection(db, 'service_reports'),
            orderBy('uploadedAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter((item: any) => item.status === 'completed') as NotificationItem[];

            setNotifications(items);

            // Calculate unread based on uploadedAt > lastSeen
            const unread = items.filter(item => {
                const uploadedTime = item.uploadedAt?.toMillis() || 0;
                return uploadedTime > lastSeen;
            }).length;

            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [lastSeen]);

    // Handle Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = () => {
        if (!isOpen) {
            // Mark all as seen when opening
            const now = Date.now();
            setLastSeen(now);
            safeStorage.setItem('service_report_last_seen', now.toString());
            setUnreadCount(0);
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={toggleDropdown}
                className={`relative p-2.5 rounded-xl transition-all duration-300 ${isOpen
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-swing' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-950 animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-800/30">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white tracking-wide">Notifikasi</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/30">
                                        BARU
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Info className="w-6 h-6 text-slate-600" />
                                    </div>
                                    <p className="text-slate-500 text-sm">Belum ada notifikasi laporan.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/30">
                                    {notifications.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                onNotificationClick(item.maintenanceType, item.quarter, item.year);
                                                setIsOpen(false);
                                            }}
                                            className="p-4 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                                                        {item.fileName}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                                        {item.maintenanceType} • {item.quarter}
                                                    </p>
                                                    <p className="text-[10px] text-slate-600 mt-2 font-medium">
                                                        {item.uploadedAt ? formatDistanceToNow(item.uploadedAt.toMillis(), { addSuffix: true, locale: id }) : 'Baru saja'}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-700 mt-1 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800/50 text-center">
                            <p className="text-[10px] text-slate-600 font-medium">
                                Real-time update enabled
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
