// ============================================================================
// FILE: HSEApp.tsx
// Deskripsi: Aplikasi Dasbor Khusus Petugas HSE (Health, Safety, and Environment).
//            Digunakan oleh HSE Officer untuk membuat laporan inspeksi K3/HSE,
//            mengelola foto inspeksi keselamatan kerja, dan mengakses arsip dokumen HSE.
// ============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    LogOut, 
    ShieldCheck, 
    HardHat, 
    FileText, 
    Menu, 
    X, 
    ChevronRight, 
    User, 
    AlertTriangle,
    ShieldAlert,
    FolderArchive
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import { HSEReportForm } from '@/components/HSEReportForm';
import { DocumentList } from '@/components/DocumentList';
import { HSEFindings } from '@/components/HSEFindings';
import { HSEFindingsArchive } from '@/components/HSEFindingsArchive';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function HSEApp() {
    // State autentikasi user
    const { user, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    
    // State tab aktif ('inspection' untuk buat laporan HSE, 'findings' untuk input temuan K3, 'findings_archive' arsip temuan, 'iso' untuk arsip dokumen)
    const [activeTab, setActiveTab] = useState<'inspection' | 'findings' | 'findings_archive' | 'iso'>('inspection');
    const [editingData, setEditingData] = useState<any>(null); // Data laporan yang sedang di-edit
    const [sidebarOpen, setSidebarOpen] = useState(false);     // State drawer navigasi HP (Mobile)

    // Handler saat user mengklik tombol edit laporan dari daftar dokumen
    const handleEditReport = (data: any) => {
        setEditingData(data);
        setActiveTab('inspection'); // Otomatis pindah ke tab form inspeksi
    };

    // Handler untuk mereset mode edit (kembali ke mode form kosong)
    const handleClearEdit = () => {
        setEditingData(null);
    };

    // Metadata untuk masing-masing tab aktif (Judul, Subtitle, Ikon, Warna Badge)
    const getTabMeta = () => {
        switch (activeTab) {
            case 'inspection':
                return {
                    title: 'Laporan Inspeksi HSE',
                    subtitle: 'Pembuatan Formulir Inspeksi Keselamatan, Kesehatan Kerja & Lingkungan (K3)',
                    icon: HardHat,
                    badge: 'Inspeksi Rutin',
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200'
                };
            case 'findings':
                return {
                    title: 'Input Temuan K3 / HSE',
                    subtitle: 'Pencatatan & Pelaporan Temuan Unsafe Action & Unsafe Condition di Lapangan',
                    icon: AlertTriangle,
                    badge: 'Temuan K3',
                    color: 'text-rose-600',
                    bg: 'bg-rose-50',
                    border: 'border-rose-200'
                };
            case 'findings_archive':
                return {
                    title: 'Arsip Temuan HSE',
                    subtitle: 'Database & Rekapitulasi Riwayat Dokumen Temuan K3 / Safety Action Tracking',
                    icon: ShieldAlert,
                    badge: 'Arsip Temuan',
                    color: 'text-teal-600',
                    bg: 'bg-teal-50',
                    border: 'border-teal-200'
                };
            case 'iso':
                return {
                    title: 'Arsip Dokumen HSE',
                    subtitle: 'Penyimpanan & Manajemen Berkas Laporan Inspeksi HSE UTT Maintenance',
                    icon: FolderArchive,
                    badge: 'Arsip Dokumen',
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                    border: 'border-blue-200'
                };
            default:
                return {
                    title: 'HSE Portal',
                    subtitle: 'Kesehatan, Keselamatan & Lingkungan — UTT Maintenance',
                    icon: HardHat,
                    badge: 'Portal HSE',
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200'
                };
        }
    };

    // Daftar item navigasi utama HSE Portal
    const navigationItems = [
        { 
            id: 'inspection', 
            label: 'Buat Inspeksi', 
            icon: FileText, 
            activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 border-transparent',
            mobileColor: 'bg-emerald-600',
            mobileShadow: 'shadow-emerald-600/20'
        },
        { 
            id: 'findings', 
            label: 'Input Temuan K3', 
            icon: AlertTriangle, 
            activeClass: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/20 border-transparent',
            mobileColor: 'bg-red-600',
            mobileShadow: 'shadow-red-600/20'
        },
        { 
            id: 'findings_archive', 
            label: 'Arsip Temuan HSE', 
            icon: ShieldAlert, 
            activeClass: 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-md shadow-teal-600/20 border-transparent',
            mobileColor: 'bg-teal-600',
            mobileShadow: 'shadow-teal-600/20'
        },
        { 
            id: 'iso', 
            label: 'Arsip Dokumen', 
            icon: FolderArchive, 
            activeClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20 border-transparent',
            mobileColor: 'bg-blue-600',
            mobileShadow: 'shadow-blue-600/20'
        },
    ];

    const tabMeta = getTabMeta();

    return (
        <div className="flex-1 flex flex-col w-full font-geist text-slate-800">
            {/* Drawer Sidebar Navigasi Layar HP / Mobile */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        {/* Backdrop Gelap saat Sidebar HP Terbuka */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] md:hidden"
                        />
                        {/* Panel Menu Samping Kanan HP */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 z-[70] md:hidden flex flex-col shadow-2xl text-slate-800"
                        >
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <img src={logoDwimitra} alt="Dwimitra" className="w-10 h-10 object-contain flex-shrink-0" />
                                    <div>
                                        <p className="font-black text-slate-900 text-xs leading-tight">PT Dwimitra Ekatama Mandiri</p>
                                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Sistem HSE</span>
                                    </div>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900" title="Tutup Menu">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Tombol-tombol Tab Navigasi di Drawer Mobile */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Navigasi Utama</p>
                                {navigationItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveTab(item.id as any);
                                            setSidebarOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 cursor-pointer ${
                                            activeTab === item.id 
                                            ? `${item.mobileColor} text-white shadow-lg ${item.mobileShadow}` 
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500'}`} />
                                            <span className="font-bold text-sm">{item.label}</span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === item.id ? 'translate-x-1' : 'opacity-0'}`} />
                                    </button>
                                ))}
                            </div>

                            {/* Info Akun HSE Officer & Tombol Log Out di Mobile */}
                            <div className="p-4 border-t border-slate-200 space-y-4 bg-slate-50/50">
                                <div className="flex items-center gap-3 px-4 py-2">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500 truncate font-medium">HSE Officer</p>
                                        <p className="text-sm font-bold text-slate-900 truncate">{user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSidebarOpen(false);
                                        setLogoutModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border border-red-200 transition-all font-bold text-sm shadow-sm cursor-pointer"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span>Keluar dari Sistem</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Navbar Atas Desktop & Mobile (Sticky Header) */}
            <div className="bg-white/85 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50 shadow-xs text-slate-800">
                {/* Baris 1: Logo, Nama Perusahaan & Akun Sesi */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 sm:gap-3.5">
                            <img
                                src={logoDwimitra}
                                alt="PT Dwimitra Ekatama Mandiri"
                                className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 object-contain"
                            />
                            <div>
                                <h1 className="text-xs sm:text-base font-black text-slate-900 leading-tight">
                                    PT Dwimitra Ekatama Mandiri
                                </h1>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-200">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        <span className="text-[10px] sm:text-xs text-emerald-700 font-bold tracking-wide">
                                            HSE OFFICER
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Akun & Tombol Aksi Desktop */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block text-right">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Masuk sebagai</p>
                                <p className="text-sm font-bold text-slate-800 truncate max-w-[260px]">
                                    {user?.email}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setLogoutModalOpen(true)}
                                className="hidden md:flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 rounded-xl border border-slate-200 transition text-xs font-bold shadow-xs cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Keluar</span>
                            </motion.button>
                            {/* Tombol Menu Mobile */}
                            <button 
                                onClick={() => setSidebarOpen(true)}
                                className="md:hidden p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 text-slate-700 shadow-xs cursor-pointer"
                                title="Buka Menu Navigasi"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Baris 2: Tab Navigasi Sekunder Tampilan Desktop & Tablet */}
                <div className="hidden md:block bg-gradient-to-r from-emerald-50/50 via-slate-50/80 to-teal-50/50 border-t border-slate-200/70">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                        <div className="flex items-center justify-center gap-1.5 lg:gap-2">
                            {navigationItems.map((item) => (
                                <motion.button
                                    key={item.id}
                                    whileHover={{ y: -1, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setActiveTab(item.id as any)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer ${
                                        activeTab === item.id
                                            ? item.activeClass
                                            : 'bg-white/90 text-slate-600 border-slate-200/90 hover:bg-white hover:text-slate-900 hover:border-slate-300 shadow-2xs'
                                    }`}
                                >
                                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span>{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Subheader Judul Halaman Aktif (Banner Rapi & Bersih) */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-2xs text-slate-800">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                            <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-2xs ${tabMeta.bg} ${tabMeta.border}`}>
                                <tabMeta.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${tabMeta.color}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                                        {tabMeta.title}
                                    </h2>
                                    <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${tabMeta.bg} ${tabMeta.color} ${tabMeta.border}`}>
                                        {tabMeta.badge}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                                    {tabMeta.subtitle}
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <span>Sistem Manajemen K3</span>
                            <span>•</span>
                            <span className="text-slate-600 font-bold">UTT Maintenance</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Konten Utama HSE Portal: Form Inspeksi HSE, Input Temuan K3, Arsip Temuan, atau Daftar Dokumen HSE */}
            <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-all">
                {activeTab === 'iso' ? (
                    <DocumentList 
                        filterOverride="hse_utt" 
                        onEdit={handleEditReport} 
                    />
                ) : activeTab === 'findings' ? (
                    <HSEFindings onSuccess={() => setActiveTab('findings_archive')} />
                ) : activeTab === 'findings_archive' ? (
                    <HSEFindingsArchive />
                ) : (
                    <HSEReportForm 
                        mode="inspection"
                        editingData={editingData} 
                        onClearEdit={handleClearEdit} 
                    />
                )}
            </div>

            {/* Footer Hak Cipta Perusahaan */}
            <Footer />

            {/* Modal Konfirmasi Log Out */}
            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={logout}
                userEmail={user?.email || ''}
            />
        </div>
    );
}
