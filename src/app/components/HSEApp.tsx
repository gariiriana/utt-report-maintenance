import { useState } from 'react';
import { motion } from 'motion/react';
import { LogOut, ShieldCheck, HardHat, FileText, FolderOpen } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { DataCenterBackground } from './DataCenterBackground';
import { HSEReportForm } from './HSEReportForm';
import { DocumentList, ExcelDocument } from './DocumentList';
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

export function HSEApp() {
    const { user, logout } = useAuth();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'report' | 'archive'>('report');
    const [editingData, setEditingData] = useState<ExcelDocument | null>(null);

    const handleEditReport = (doc: ExcelDocument) => {
        setEditingData(doc);
        setActiveTab('report');
    };

    const clearEditingData = () => {
        setEditingData(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden font-geist text-slate-200">
            <DataCenterBackground />

            {/* Header */}
            <div className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src={logoUTT}
                                alt="PT United Transworld Trading"
                                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
                            />
                            <div>
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
                            <div className="hidden sm:block text-right">
                                <p className="text-xs text-slate-500">Logged as</p>
                                <p className="text-sm font-medium text-slate-300 truncate max-w-[200px]">
                                    {user?.email}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setLogoutModalOpen(true)}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg border border-slate-700/50 transition text-sm"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Page Title & Navigation */}
            <div className="bg-slate-900/40 backdrop-blur-md border-b border-slate-700/30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-green-500/15 rounded-xl border border-green-500/25">
                                <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-xl font-bold text-white">
                                    HSE Inspection Report
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    Health, Safety & Environment — Maintenance Checklist
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 bg-slate-950/40 p-1.5 rounded-2xl border border-slate-700/30">
                            <button
                                onClick={() => setActiveTab('report')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'report'
                                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                Create
                            </button>
                            <button
                                onClick={() => setActiveTab('archive')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'archive'
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <FolderOpen className="w-4 h-4" />
                                Archive
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {activeTab === 'report' ? (
                    <HSEReportForm editingData={editingData} onClearEdit={clearEditingData} />
                ) : (
                    <DocumentList onEdit={handleEditReport} />
                )}
            </div>

            {/* Logout Modal */}
            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={logout}
                userEmail={user?.email || ''}
            />
        </div>
    );
}
