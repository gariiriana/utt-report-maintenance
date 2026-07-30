import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, ShieldCheck, HardHat, FileText, Folder, Menu, X, ChevronRight, User } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import { HSEReportForm } from '@/components/HSEReportForm';
import { DocumentList } from '@/components/DocumentList';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function HSEApp() {
    const { user, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'inspection' | 'iso'>('inspection');
    const [editingData, setEditingData] = useState<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleEditReport = (data: any) => {
        setEditingData(data);
        setActiveTab('inspection'); 
    };

    const handleClearEdit = () => {
        setEditingData(null);
    };

    const getTabLabel = () => {
        switch (activeTab) {
            case 'inspection': return 'Laporan Inspeksi HSE';
            case 'iso': return 'Arsip Dokumen HSE';
            default: return 'HSE Portal';
        }
    };

    const navigationItems = [
        { id: 'inspection', label: 'Buat Inspeksi', icon: FileText, color: 'bg-green-600', shadow: 'shadow-green-600/20' },
        { id: 'iso', label: 'Arsip Dokumen', icon: Folder, color: 'bg-emerald-600', shadow: 'shadow-emerald-600/20' },
    ];

    return (
        <div className="min-h-screen font-geist text-slate-800">
            {/* Mobile Drawer */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 z-[70] lg:hidden flex flex-col shadow-2xl text-slate-800"
                        >
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={logoDwimitra} alt="Dwimitra" className="w-10 h-10 object-contain" />
                                    <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Sistem HSE</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900" title="Tutup Menu">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

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
                                            ? `${item.color} text-white shadow-lg ${item.shadow}` 
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

                            <div className="p-4 border-t border-slate-200 space-y-4 bg-slate-50/50">
                                <div className="flex items-center gap-3 px-4 py-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
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

            {/* Top Navbar */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-sky-100/80 sticky top-0 z-50 shadow-sm text-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src={logoDwimitra}
                                alt="PT Dwimitra Ekatama Mandiri"
                                className="w-10 h-10 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                                    PT Dwimitra Ekatama Mandiri
                                </h1>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 rounded-full border border-green-200">
                                        <ShieldCheck className="w-3 h-3 text-green-600" />
                                        <span className="text-[10px] sm:text-xs text-green-700 font-bold tracking-wide">
                                            HSE OFFICER
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-700"
                                title="Buka Menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div className="hidden lg:block text-right">
                                <p className="text-xs text-slate-500 font-medium">Masuk sebagai</p>
                                <p className="text-sm font-bold text-slate-800 truncate max-w-[260px]">
                                    {user?.email}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setLogoutModalOpen(true)}
                                className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition text-sm font-bold shadow-sm cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Keluar</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subheader Navigation */}
            <div className="bg-white/90 backdrop-blur-md border-b border-sky-100/80 shadow-sm text-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-green-50 rounded-xl border border-green-100">
                                <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-xl font-black text-slate-900">
                                    {getTabLabel()}
                                </h2>
                                <p className="text-xs sm:text-sm font-medium text-slate-600">
                                    Kesehatan, Keselamatan & Lingkungan — UTT Maintenance
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                            {navigationItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as any)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${activeTab === item.id
                                        ? `${item.color} text-white shadow-md ${item.shadow}`
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    <item.icon className="w-3.5 h-3.5" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {activeTab === 'iso' ? (
                    <DocumentList 
                        filterOverride="hse_utt" 
                        onEdit={handleEditReport} 
                    />
                ) : (
                    <HSEReportForm 
                        mode={activeTab}
                        editingData={editingData} 
                        onClearEdit={handleClearEdit} 
                    />
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

