import { ServerLoadingIndicator } from '@/components/ServerLoadingIndicator';
// ============================================================================
// FILE: HSEApp.tsx
// Deskripsi: Aplikasi Dasbor Khusus Petugas HSE (Health, Safety, and Environment).
//            Digunakan oleh HSE Officer untuk membuat laporan inspeksi K3/HSE,
//            mengelola foto inspeksi keselamatan kerja, dan mengakses arsip dokumen HSE.
// ============================================================================

import { useAppUpdateDraft } from '@/hooks/useAppUpdateDraft';
import { useMenuNavigation, useNavigationState } from '@/hooks/useAppNavigation';
import { useState } from 'react';
import { motion } from 'motion/react';
import {
    LogOut,
    ShieldCheck,
    HardHat,
    FileText,
    Menu,
    AlertTriangle,
    ShieldAlert,
    FolderArchive,
    Clock,
    UserCheck
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { AppSidebar, MenuSection, NavItemDef } from '@/components/AppSidebar';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import { HSEReportForm } from '@/components/HSEReportForm';
import { DocumentList } from '@/components/DocumentList';
import { HSEFindings } from '@/components/HSEFindings';
import { HSEFindingsArchive } from '@/components/HSEFindingsArchive';
import { HSETbmForm } from '@/components/HSETbmForm';
import { HSESafetyInductionForm } from '@/components/HSESafetyInductionForm';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

type HSETab = 'inspection' | 'tbm' | 'induction' | 'findings' | 'findings_archive' | 'iso' | 'management_files';

// Menu navigasi HSE Portal (sidebar kiri di desktop, drawer di HP — sama dengan role lain)
const HSE_NAV_ITEMS: readonly NavItemDef[] = [
    { id: 'inspection', label: 'Buat Inspeksi', icon: FileText, color: 'from-emerald-600 to-teal-600', show: true },
    { id: 'tbm', label: 'Absen TBM', icon: Clock, color: 'from-indigo-600 to-violet-600', show: true },
    { id: 'induction', label: 'Safety Induction', icon: UserCheck, color: 'from-amber-500 to-orange-600', show: true },
    { id: 'findings', label: 'Input Temuan K3', icon: AlertTriangle, color: 'from-red-600 to-rose-600', show: true },
    { id: 'findings_archive', label: 'Arsip Temuan HSE', icon: ShieldAlert, color: 'from-teal-600 to-cyan-700', show: true },
    { id: 'iso', label: 'Arsip Dokumen HSE', icon: FolderArchive, color: 'from-blue-600 to-indigo-600', show: true },
    { id: 'management_files', label: 'Management File', icon: FolderArchive, color: 'from-amber-500 to-orange-600', show: true },
];

const HSE_MENU_SECTIONS: readonly MenuSection[] = [
    { title: 'Laporan & Absensi K3', itemIds: ['inspection', 'tbm', 'induction'] },
    { title: 'Temuan K3', itemIds: ['findings', 'findings_archive'] },
    { title: 'Arsip & Dokumen', itemIds: ['iso', 'management_files'] },
];

export function HSEApp() {
    // State autentikasi user
    const { user, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    // State tab aktif HSE Portal
    const [activeTab, setActiveTab] = useMenuNavigation<HSETab>('inspection', HSE_NAV_ITEMS.map(item => item.id));
    // State tipe temuan K3 yang dipilih ('negative' atau 'positive')
    const [findingsTypeSelection, setFindingsTypeSelection] = useNavigationState<'negative' | 'positive'>('HSEApp.findingsType', 'negative', ['negative', 'positive']);
    const [editingData, setEditingData] = useState<any>(null);

    const restoringUpdateDraft = useAppUpdateDraft('HSEApp', { editingData }, saved => {
      setEditingData(saved.editingData);
    }, true);
 // Data laporan yang sedang di-edit
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);   // Drawer navigasi HP (Mobile)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Handler saat user mengklik tombol edit laporan dari daftar dokumen
    const handleEditReport = (data: any) => {
        setEditingData(data);
        if (data.hseType === 'tbm') {
            setActiveTab('tbm');
        } else if (data.hseType === 'induction') {
            setActiveTab('induction');
        } else {
            setActiveTab('inspection'); // Otomatis pindah ke tab form inspeksi
        }
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
            case 'tbm':
                return {
                    title: 'Absen TBM (Toolbox Meeting)',
                    subtitle: 'Pencatatan Waktu Pelaksanaan, Total SDM Hadir & Dokumentasi Foto TBM',
                    icon: Clock,
                    badge: 'Toolbox Meeting',
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50',
                    border: 'border-indigo-200'
                };
            case 'induction':
                return {
                    title: 'Safety Induction Report',
                    subtitle: 'Pendaftaran Peserta Induction, Asal PT, Foto Kegiatan, Surat Sehat & Sertifikat K3',
                    icon: UserCheck,
                    badge: 'Safety Induction',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                    border: 'border-amber-200'
                };
            case 'findings':
                return {
                    title: findingsTypeSelection === 'positive' ? 'Input Temuan Positif K3' : 'Input Temuan Negatif K3',
                    subtitle: findingsTypeSelection === 'positive'
                        ? 'Pencatatan & Apresiasi Tindakan Aman (Safe Behavior) & Kepatuhan K3 Teladan'
                        : 'Pencatatan & Pelaporan Temuan Unsafe Action & Unsafe Condition di Lapangan',
                    icon: findingsTypeSelection === 'positive' ? ShieldCheck : AlertTriangle,
                    badge: findingsTypeSelection === 'positive' ? 'Temuan Positif' : 'Temuan Negatif',
                    color: findingsTypeSelection === 'positive' ? 'text-emerald-600' : 'text-rose-600',
                    bg: findingsTypeSelection === 'positive' ? 'bg-emerald-50' : 'bg-rose-50',
                    border: findingsTypeSelection === 'positive' ? 'border-emerald-200' : 'border-rose-200'
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
            case 'management_files':
                return {
                    title: 'Management File',
                    subtitle: 'Penyimpanan & Manajemen Berkas Laporan & Dokumentasi Maintenance Terpusat',
                    icon: FolderArchive,
                    badge: 'Management File',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                    border: 'border-amber-200'
                };
            case 'iso':
                return {
                    title: 'Arsip Dokumen HSE',
                    subtitle: 'Penyimpanan & Manajemen Berkas Laporan Inspeksi, Absen TBM & Safety Induction',
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

    // Warna menu "Input Temuan K3" mengikuti jenis temuan yang dipilih (negatif = merah, positif = hijau)
    const navItems = HSE_NAV_ITEMS.map(item =>
        item.id === 'findings' && findingsTypeSelection === 'positive'
            ? { ...item, color: 'from-emerald-600 to-teal-600' }
            : item
    );

    const tabMeta = getTabMeta();

    return (
        <div className="flex flex-col w-full min-h-screen font-geist text-slate-800">
            {/* Sidebar Kiri (Desktop) & Drawer (Mobile), sama dengan role lain */}
            <AppSidebar
                user={user}
                activeTab={activeTab}
                setActiveTab={(tab: HSETab) => setActiveTab(tab)}
                navItems={navItems}
                sections={HSE_MENU_SECTIONS}
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
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-xs px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Mobile: Logo + Nama Perusahaan */}
                        <div className="md:hidden flex items-center gap-2 min-w-0">
                            <img src={logoDwimitra} alt="PT Dwimitra Ekatama Mandiri" className="w-7 h-7 object-contain shrink-0" />
                            <div className="min-w-0">
                                <h2 className="text-[11.5px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                                    PT Dwimitra Ekatama Mandiri
                                </h2>
                                <p className="text-[9.5px] text-emerald-700 font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 uppercase tracking-wide">
                                    Sistem HSE · HSE Officer
                                </p>
                            </div>
                        </div>

                        {/* Desktop: Judul Halaman + Badge Role */}
                        <div className="hidden md:flex items-center gap-2.5 min-w-0">
                            <h1 className="text-base font-bold text-slate-900 truncate">{tabMeta.title}</h1>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-200 shrink-0">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase">HSE Officer</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
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

                {/* Subheader Judul Halaman Aktif */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-2xs text-slate-800">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                                <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border shadow-2xs shrink-0 ${tabMeta.bg} ${tabMeta.border}`}>
                                    <tabMeta.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${tabMeta.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[15px] sm:text-lg font-black text-slate-900 leading-tight">
                                            {tabMeta.title}
                                        </h2>
                                        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${tabMeta.bg} ${tabMeta.color} ${tabMeta.border}`}>
                                            {tabMeta.badge}
                                        </span>
                                    </div>
                                    <p className="hidden sm:block text-sm font-medium text-slate-500 mt-0.5">
                                        {tabMeta.subtitle}
                                    </p>
                                </div>
                            </div>

                            {/* Switcher Cepat Positif / Negatif (Khusus Tab Input Temuan K3) */}
                            {activeTab === 'findings' ? (
                                <div className="grid grid-cols-2 sm:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 sm:self-auto shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setFindingsTypeSelection('negative')}
                                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            findingsTypeSelection === 'negative'
                                                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                        <span>🔴 Negatif</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFindingsTypeSelection('positive')}
                                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            findingsTypeSelection === 'positive'
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                        <span>🟢 Positif</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400">
                                    <span>Sistem Manajemen K3</span>
                                    <span>•</span>
                                    <span className="text-slate-600 font-bold">UTT Maintenance</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Konten Utama HSE Portal: Form Inspeksi HSE, Input Temuan K3, Arsip Temuan, atau Daftar Dokumen HSE */}
                <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-8 transition-all">
                    {restoringUpdateDraft ? <ServerLoadingIndicator /> : activeTab === 'management_files' ? (
                        <DocumentList
                            onEdit={handleEditReport}
                        />
                    ) : activeTab === 'iso' ? (
                        <DocumentList
                            filterOverride="hse_utt"
                            onEdit={handleEditReport}
                        />
                    ) : activeTab === 'tbm' ? (
                        <HSETbmForm
                            editingData={editingData}
                            onClearEdit={handleClearEdit}
                            onSuccess={() => setActiveTab('iso')}
                        />
                    ) : activeTab === 'induction' ? (
                        <HSESafetyInductionForm
                            editingData={editingData}
                            onClearEdit={handleClearEdit}
                            onSuccess={() => setActiveTab('iso')}
                        />
                    ) : activeTab === 'findings' ? (
                        <HSEFindings
                            initialType={findingsTypeSelection}
                            onTypeChange={setFindingsTypeSelection}
                            onSuccess={() => setActiveTab('findings_archive')}
                        />
                    ) : activeTab === 'findings_archive' ? (
                        <HSEFindingsArchive />
                    ) : (
                        <HSEReportForm
                            mode="inspection"
                            editingData={editingData}
                            onClearEdit={handleClearEdit}
                        />
                    )}
                </main>

                {/* Footer Hak Cipta Perusahaan */}
                <Footer />
            </div>

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
