import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, ShieldCheck, HardHat, FileText, Folder, Menu, X, ChevronRight, User } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import { HSEReportForm } from '@/components/HSEReportForm';
import { DocumentList } from '@/components/DocumentList';
import logoUTT from '@/assets/logo_utt.png';

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
            case 'iso': return 'Dokumen ISO HSE';
            default: return 'HSE Portal';
        }
    };

    const navigationItems = [
        { id: 'inspection', label: 'Buat Inspeksi', icon: FileText, color: 'bg-green-600', shadow: 'shadow-green-600/20' },
        { id: 'iso', label: 'Dokumen ISO', icon: Folder, color: 'bg-emerald-600', shadow: 'shadow-emerald-600/20' },
    ];

    return (
        <div className="min-h-screen font-geist text-slate-200">
            {}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-700/50 z-[70] lg:hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={logoUTT} alt="UTT" className="w-10 h-10 object-contain" />
                                    <span className="font-bold text-white text-sm uppercase tracking-wider">HSE System</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
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
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 ${
                                            activeTab === item.id 
                                            ? `${item.color} text-white shadow-xl ${item.shadow}` 
                                            : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/60'
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

                            <div className="p-4 border-t border-slate-700/50 space-y-4 bg-slate-950/30">
                                <div className="flex items-center gap-3 px-4 py-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500 truncate">HSE Officer</p>
                                        <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSidebarOpen(false);
                                        setLogoutModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 p-4 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-2xl border border-red-500/20 transition-all font-bold text-sm"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span>Keluar dari Sistem</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src={logoUTT}
                                alt="PT United Transworld Trading"
                                className="w-10 h-10 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-sm sm:text-base font-semibold text-white leading-tight">
                                    PT United Transworld Trading
                                </h1>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/15 rounded-full border border-green-500/25">
                                        <ShieldCheck className="w-3 h-3 text-green-400" />
                                        <span className="text-[10px] sm:text-xs text-green-400 font-semibold tracking-wide">
                                            HSE OFFICER
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {}
                            <button 
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 text-slate-300"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div className="hidden lg:block text-right">
                                <p className="text-xs text-slate-500">Masuk sebagai</p>
                                <p className="text-sm font-medium text-slate-300 truncate max-w-[200px]">
                                    {user?.email}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setLogoutModalOpen(true)}
                                className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg border border-slate-700/50 transition text-sm"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Keluar</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border-b border-slate-700/30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-green-500/15 rounded-xl border border-green-500/25">
                                <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-xl font-bold text-white">
                                    {getTabLabel()}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    Kesehatan, Keselamatan & Lingkungan — UTT Maintenance
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-wrap gap-2 bg-slate-950/40 p-1.5 rounded-2xl border border-slate-700/30">
                            {navigationItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as any)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${activeTab === item.id
                                        ? `${item.color} text-white shadow-lg ${item.shadow}`
                                        : 'text-slate-500 hover:text-slate-300'
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

