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
import { DataCenterBackground } from '@/components/DataCenterBackground';
import { Footer } from '@/components/Footer';
import logoUTT from '@/assets/logo_utt.png';

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

    // Default to the user's own division if they are a division user
    const [activeDivision, setActiveDivision] = useState<string | null>(isDivisionUser ? userRole : null);
    const [showVault, setShowVault] = useState(false);

    const directorTitles: Record<string, string> = {
        'dirut': 'Direktur Utama',
        'direksiSDM': 'Direktur SDM',
        'DireksiKeuangan': 'Direktur Keuangan'
    };
    const directorTitle = directorTitles[userRole || ''] || 'Director';

    const getDivisionDetails = (id: string) => DIVISIONS.find(d => d.id === id);

    return (
        <div className="min-h-screen relative overflow-hidden font-geist text-slate-200">
            <DataCenterBackground />

            {/* Sticky Header */}
            <div className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
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
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 rounded-full border border-blue-500/25">
                                        <ShieldCheck className="w-3 h-3 text-blue-400" />
                                        <span className="text-[10px] sm:text-xs text-blue-400 font-semibold tracking-wide uppercase">
                                            {isDirector ? directorTitle : (getDivisionDetails(userRole || '')?.name || 'Division Member')}
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

            {/* Main Content Area */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {isDirector && !showVault ? (
                    <div className="space-y-8">
                        <div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Executive Registry</h2>
                            <p className="text-slate-400 text-lg">Select a department to access their ISO records directly.</p>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
                            {/* Sidebar Navigation - Registry Table Look */}
                            <div className="w-full lg:w-80 flex flex-col shrink-0 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/60 overflow-hidden shadow-2xl">
                                <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-800/20">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Department Registry</p>
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
                                                className={`flex items-center gap-4 px-6 py-5 transition-all duration-300 group relative ${
                                                    index !== DIVISIONS.length - 1 ? 'border-b border-slate-800/50' : ''
                                                } ${
                                                    IsActive 
                                                    ? `bg-blue-500/10` 
                                                    : `hover:bg-slate-800/40`
                                                }`}
                                            >
                                                {/* Active Accent Border */}
                                                {IsActive && (
                                                    <motion.div 
                                                        layoutId="active-nav-border"
                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[2px_0_12px_rgba(59,130,246,0.5)]"
                                                    />
                                                )}

                                                <div className={`p-2 rounded-lg border transition-all duration-300 ${
                                                    IsActive 
                                                    ? `bg-blue-500/20 border-blue-500/40 text-blue-400` 
                                                    : `bg-slate-800/60 border-slate-700/50 text-slate-500 group-hover:text-slate-300 group-hover:border-slate-600`
                                                }`}>
                                                    <div.icon size={18} strokeWidth={2.5} />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`text-sm font-bold transition-colors ${IsActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                        {div.name}
                                                    </p>
                                                    <p className="text-[9px] uppercase tracking-widest text-slate-600 font-bold group-hover:text-slate-500 transition-colors">ISO Control</p>
                                                </div>
                                                
                                                <ChevronRight size={14} className={`transition-all duration-300 ${IsActive ? 'text-blue-400 translate-x-1' : 'text-slate-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Info Box - Glassmorphism Empty State (Hidden on Mobile) */}
                            <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center p-8 bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="relative z-10 w-24 h-24 rounded-full bg-slate-800/60 flex items-center justify-center border border-slate-700/50 mb-6 shadow-xl">
                                    <ShieldCheck size={36} className="text-slate-500 animate-pulse" />
                                </div>
                                <div className="relative z-10 max-w-xs">
                                    <h3 className="text-2xl font-bold text-slate-300 mb-3 italic tracking-tight">System Ready</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed px-4">
                                        Select a department from the registry table on the left to gain instantaneous access to their secure ISO documentation vault.
                                    </p>
                                </div>
                                
                                {/* Decorative Glare */}
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
                                Back to Hub
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
