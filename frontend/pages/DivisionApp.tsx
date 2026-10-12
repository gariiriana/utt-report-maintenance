// ============================================================================
// FILE: DivisionApp.tsx
// Deskripsi: Aplikasi Dasbor Divisi (PMO, Sales, Presales, Purchasing, HSE).
//            Menyediakan antarmuka manajemen dokumen ISO terisolasi untuk masing-masing
//            divisi perusahaan serta mode Registri Eksekutif khusus bagi Direksi.
//            Navigasi lewat sidebar kiri (AppSidebar) yang sama dengan role lain.
// ============================================================================

import { useState } from 'react';
import { motion } from 'motion/react';
import {
    LogOut,
    Menu,
    TrendingUp,
    Layout,
    ShoppingCart,
    ShieldCheck,
    ChevronRight,
    Briefcase,
    HardHat,
    FolderArchive
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';
import { AppSidebar, MenuSection, NavItemDef } from '@/components/AppSidebar';
import { FileManagement } from '@/components/FileManagement';
import { DocumentList } from '@/components/DocumentList';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import { Footer } from '@/components/Footer';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

// Daftar divisi perusahaan beserta ikon dan konfigurasi warna
const DIVISIONS = [
    { id: 'pmo', name: 'PMO', icon: Layout, color: 'blue' },
    { id: 'sales', name: 'Sales', icon: TrendingUp, color: 'emerald' },
    { id: 'presales', name: 'Presales', icon: Briefcase, color: 'purple' },
    { id: 'purchasing', name: 'Purchasing', icon: ShoppingCart, color: 'orange' },
    { id: 'hse_reports', name: 'HSE Reports', icon: HardHat, color: 'green', isSpecial: true }
];

type DivisionTab = 'iso' | 'management_files';

const DIVISION_MENU_SECTIONS: readonly MenuSection[] = [
    { title: 'Dokumen', itemIds: ['iso', 'management_files'] },
];

export function DivisionApp() {
    // State autentikasi user
    const { user, userRole, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Pengecekan peranan (role): Apakah jajaran Direksi atau Anggota Divisi spesifik
    const isDirector = ['dirut', 'direksiSDM', 'DireksiKeuangan'].includes(userRole || '');
    const isDivisionUser = ['pmo', 'sales', 'presales', 'purchasing'].includes(userRole || '');
    const [activeDivision, setActiveDivision] = useState<string | null>(isDivisionUser ? userRole : null);
    const [showVault, setShowVault] = useState(false);
    const [currentTab, setCurrentTab] = useState<DivisionTab>('iso');

    // Pemetaan nama jabatan Direksi dalam Bahasa Indonesia
    const directorTitles: Record<string, string> = {
        'dirut': 'Direktur Utama',
        'direksiSDM': 'Direktur SDM',
        'DireksiKeuangan': 'Direktur Keuangan'
    };
    const directorTitle = directorTitles[userRole || ''] || 'Direktur';

    // Helper untuk mengambil metadata divisi berdasarkan ID
    const getDivisionDetails = (id: string) => DIVISIONS.find(d => d.id === id);
    const roleLabel = isDirector ? directorTitle : (getDivisionDetails(userRole || '')?.name || 'Anggota Divisi');

    const navItems: NavItemDef[] = [
        { id: 'iso', label: isDirector ? 'Registri ISO Divisi' : 'Dokumen Divisi', icon: Briefcase, color: 'from-blue-600 to-indigo-600', show: true },
        { id: 'management_files', label: 'Management File', icon: FolderArchive, color: 'from-amber-500 to-orange-600', show: true },
    ];
    const currentNavItem = navItems.find(item => item.id === currentTab);

    const handleTabChange = (tab: DivisionTab) => {
        // Direksi yang membuka menu Registri dari menu kembali ke daftar departemen
        if (tab === 'iso' && isDirector) {
            setShowVault(false);
            setActiveDivision(null);
        }
        setCurrentTab(tab);
    };

    return (
        <div className="flex flex-col w-full min-h-screen">
            {/* Sidebar Kiri (Desktop) & Drawer (Mobile), sama dengan role lain */}
            <AppSidebar
                user={user}
                activeTab={currentTab}
                setActiveTab={handleTabChange}
                navItems={navItems}
                sections={DIVISION_MENU_SECTIONS}
                pendingDeleteCount={0}
                totalAbnormalCount={0}
                isCollapsed={sidebarCollapsed}
                setIsCollapsed={setSidebarCollapsed}
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                onLogoutClick={() => setLogoutModalOpen(true)}
            />

            <div
                className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${
                    sidebarCollapsed ? 'md:pl-20' : 'md:pl-80'
                }`}
            >
                {/* Top Bar — Logo (mobile) / Judul (desktop), Notifikasi, Akun, Tombol Logout */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-xs px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Mobile: Logo + Nama Perusahaan + Jabatan */}
                        <div className="md:hidden flex items-center gap-2 min-w-0">
                            <img src={logoDwimitra} alt="PT Dwimitra Ekatama Mandiri" className="w-7 h-7 object-contain shrink-0" />
                            <div className="min-w-0">
                                <h2 className="text-[11.5px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                                    PT Dwimitra Ekatama Mandiri
                                </h2>
                                <p className="text-[9.5px] text-blue-700 font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 uppercase tracking-wide">
                                    {roleLabel}
                                </p>
                            </div>
                        </div>

                        {/* Desktop: Judul Halaman + Badge Jabatan */}
                        <div className="hidden md:flex items-center gap-2.5 min-w-0">
                            <h1 className="text-base font-bold text-slate-900 truncate">{currentNavItem?.label || 'Dokumen Divisi'}</h1>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200 shrink-0">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                <span className="text-[10px] font-bold text-blue-700 uppercase">{roleLabel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <NotificationCenter onSelectNotification={(item) => {
                            toast.info(`Membuka: ${item.fileName}`);
                        }} />

                        <div className="hidden md:block text-right">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Masuk sebagai</p>
                            <p className="text-sm font-semibold text-slate-700 truncate max-w-[260px]">{user?.email}</p>
                        </div>

                        {/* Logout desktop (di mobile ada di dalam drawer sidebar) */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setLogoutModalOpen(true)}
                            className="hidden md:flex p-2.5 bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-all shadow-sm cursor-pointer"
                            title="Keluar Sesi"
                        >
                            <LogOut className="w-5 h-5" />
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setMobileMenuOpen(true)}
                            className="p-2 md:hidden bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl border border-slate-200 shadow-sm cursor-pointer"
                            title="Buka Menu"
                            aria-label="Buka Menu"
                        >
                            <Menu className="w-5 h-5" />
                        </motion.button>
                    </div>
                </header>

                {/* Konten Utama Aplikasi Divisi */}
                <main className="relative z-10 flex-1 w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
                    {currentTab === 'management_files' ? (
                        <DocumentList />
                    ) : isDirector && !showVault ? (
                        <div className="space-y-5 sm:space-y-8">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1 sm:mb-2 tracking-tight">Registri Eksekutif</h2>
                                <p className="text-slate-600 font-medium text-sm sm:text-lg">Pilih departemen untuk mengakses arsip ISO secara langsung.</p>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 lg:min-h-[600px]">
                                {/* Navigasi Daftar Departemen Sisi Kiri */}
                                <div className="w-full lg:w-80 flex flex-col shrink-0 bg-white/90 backdrop-blur-md rounded-3xl border border-sky-100/90 overflow-hidden shadow-lg text-slate-800">
                                    <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 bg-slate-50/80">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Registri Departemen</p>
                                    </div>
                                    <div className="flex flex-col">
                                        {DIVISIONS.map((div, index) => {
                                            const IsActive = activeDivision === div.id;
                                            return (
                                                <button
                                                    key={div.id}
                                                    onClick={() => {
                                                        setActiveDivision(div.id);
                                                        setShowVault(true);
                                                    }}
                                                    className={`flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 transition-all duration-300 group relative cursor-pointer ${
                                                        index !== DIVISIONS.length - 1 ? 'border-b border-slate-200' : ''
                                                    } ${
                                                        IsActive
                                                        ? `bg-blue-50/80`
                                                        : `hover:bg-slate-50`
                                                    }`}
                                                >
                                                    {/* Batang Indikator Aktif */}
                                                    {IsActive && (
                                                        <motion.div
                                                            layoutId="active-nav-border"
                                                            className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 rounded-r-full"
                                                        />
                                                    )}

                                                    <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                                                        IsActive
                                                        ? `bg-blue-50 border-blue-200 text-blue-600`
                                                        : `bg-slate-100 border-slate-200 text-slate-500 group-hover:text-slate-800 group-hover:border-slate-300`
                                                    }`}>
                                                        <div.icon size={18} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="text-left flex-1">
                                                        <p className={`text-sm font-bold transition-colors ${IsActive ? 'text-slate-900 font-black' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                                            {div.name}
                                                        </p>
                                                        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold group-hover:text-slate-600 transition-colors">Kontrol ISO</p>
                                                    </div>

                                                    <ChevronRight size={14} className={`transition-all duration-300 ${IsActive ? 'text-blue-600 translate-x-1' : 'text-slate-400 lg:opacity-0 lg:group-hover:opacity-100 group-hover:translate-x-0'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tampilan Kosong Sisi Kanan (Placeholder Sebelum Memilih Divisi) */}
                                <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center p-8 bg-white/90 backdrop-blur-md border border-sky-100/90 rounded-[2.5rem] shadow-lg relative overflow-hidden group text-slate-800">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div className="relative z-10 w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 mb-6 shadow-md">
                                        <ShieldCheck size={36} className="text-blue-600 animate-pulse" />
                                    </div>
                                    <div className="relative z-10 max-w-xs">
                                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Sistem Siap</h3>
                                        <p className="text-slate-600 font-medium text-sm leading-relaxed px-4">
                                            Pilih departemen dari tabel registri di sebelah kiri untuk mendapatkan akses instan ke penyimpanan dokumen ISO yang aman.
                                        </p>
                                    </div>

                                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[80px] pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Tampilan 2: Pengelola Berkas Dokumen (File Management / Document List) */
                        <div className="space-y-4 sm:space-y-6">
                            {isDirector && (
                                <button
                                    onClick={() => {
                                        setShowVault(false);
                                        setActiveDivision(null);
                                    }}
                                    className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                    Kembali ke Registri
                                </button>
                            )}

                            {activeDivision === 'hse_reports' ? (
                                <DocumentList filterOverride="hse_utt" />
                            ) : (
                                <FileManagement
                                    collectionName={activeDivision || userRole || 'files'}
                                    divisionName={getDivisionDetails(activeDivision || userRole || '')?.name}
                                    allowUpload={isDivisionUser}
                                    simpleMode={isDivisionUser}
                                />
                            )}
                        </div>
                    )}
                </main>

                {/* Footer Hak Cipta Perusahaan */}
                <Footer />
            </div>

            {/* Modal Konfirmasi Keluar / Log Out */}
            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={logout}
                userEmail={user?.email || ''}
            />
        </div>
    );
}
