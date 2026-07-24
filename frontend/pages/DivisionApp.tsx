import { useState } from 'react';
import { motion } from 'motion/react';
import {
    LogOut,
    TrendingUp,
    Layout,
    ShoppingCart,
    ShieldCheck,
    ChevronRight,
    Briefcase,
    HardHat
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { FileManagement } from '@/components/FileManagement';
import { DocumentList } from '@/components/DocumentList';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

const DIVISIONS = [
    { id: 'pmo', name: 'PMO', icon: Layout, color: 'blue' },
    { id: 'sales', name: 'Sales', icon: TrendingUp, color: 'emerald' },
    { id: 'presales', name: 'Presales', icon: Briefcase, color: 'purple' },
    { id: 'purchasing', name: 'Purchasing', icon: ShoppingCart, color: 'orange' },
    { id: 'hse_reports', name: 'HSE Reports', icon: HardHat, color: 'green', isSpecial: true }
];

export function DivisionApp() {
    const { user, userRole, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    const isDirector = ['dirut', 'direksiSDM', 'DireksiKeuangan'].includes(userRole || '');
    const isDivisionUser = ['pmo', 'sales', 'presales', 'purchasing'].includes(userRole || '');
    const [activeDivision, setActiveDivision] = useState<string | null>(isDivisionUser ? userRole : null);
    const [showVault, setShowVault] = useState(false);

    const directorTitles: Record<string, string> = {
        'dirut': 'Direktur Utama',
        'direksiSDM': 'Direktur SDM',
        'DireksiKeuangan': 'Direktur Keuangan'
    };
    const directorTitle = directorTitles[userRole || ''] || 'Direktur';

    const getDivisionDetails = (id: string) => DIVISIONS.find(d => d.id === id);

    return (
        <div className="min-h-screen flex flex-col">

            {/* Top Navbar */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-sky-100/80 sticky top-0 z-50 shadow-sm text-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src={logoDwimitra}
                                alt="PT Dwimitra Ekatama Mandiri"
                                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
                            />
                            <div>
                                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                                    PT Dwimitra Ekatama Mandiri
                                </h1>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200">
                                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                                        <span className="text-[10px] sm:text-xs text-blue-700 font-bold tracking-wide uppercase">
                                            {isDirector ? directorTitle : (getDivisionDetails(userRole || '')?.name || 'Anggota Divisi')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-right">
                                <p className="text-xs text-slate-500 font-medium">Masuk sebagai</p>
                                <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                                    {user?.email}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setLogoutModalOpen(true)}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition text-sm font-bold shadow-sm cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Keluar</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {isDirector && !showVault ? (
                    <div className="space-y-8">
                        <div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Registri Eksekutif</h2>
                            <p className="text-slate-600 font-medium text-lg">Pilih departemen untuk mengakses arsip ISO secara langsung.</p>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
                            {/* Left Navigation */}
                            <div className="w-full lg:w-80 flex flex-col shrink-0 bg-white/90 backdrop-blur-md rounded-3xl border border-sky-100/90 overflow-hidden shadow-lg text-slate-800">
                                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/80">
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
                                                className={`flex items-center gap-4 px-6 py-5 transition-all duration-300 group relative cursor-pointer ${
                                                    index !== DIVISIONS.length - 1 ? 'border-b border-slate-200' : ''
                                                } ${
                                                    IsActive
                                                    ? `bg-blue-50/80`
                                                    : `hover:bg-slate-50`
                                                }`}
                                            >
                                                {/* Active Indicator Bar */}
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

                                                <ChevronRight size={14} className={`transition-all duration-300 ${IsActive ? 'text-blue-600 translate-x-1' : 'text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Empty Vault State */}
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

                                {}
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[80px] pointer-events-none" />
                            </div>
                        </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {isDirector && (
                            <button
                                onClick={() => {
                                    setShowVault(false);
                                    setActiveDivision(null);
                                }}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors mb-4"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180" />
                                Kembali ke Beranda
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
            </div>

            <Footer />

            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={logout}
                userEmail={user?.email || ''}
            />
        </div>
    );
}

