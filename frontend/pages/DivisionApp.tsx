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

    const directorTitles: Record<string, string> = {
        'dirut': 'Direktur Utama',
        'direksiSDM': 'Direktur SDM',
        'DireksiKeuangan': 'Direktur Keuangan'
    };
    const directorTitle = directorTitles[userRole || ''] || 'Director';

    const getDivisionDetails = (id: string) => DIVISIONS.find(d => d.id === id);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden font-geist text-slate-200">
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
                {isDirector && !activeDivision ? (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Director Dashboard</h2>
                            <p className="text-slate-400 text-lg">Select a division to monitor their ISO documentation progress.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {DIVISIONS.map((div) => (
                                <motion.button
                                    key={div.id}
                                    whileHover={{ y: -5, backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setActiveDivision(div.id)}
                                    className="p-8 bg-slate-800/40 rounded-3xl border border-slate-700/50 text-left transition-all group"
                                >
                                    <div className={`w-14 h-14 rounded-2xl bg-${div.color}-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                        <div className={`text-${div.color}-400`}>
                                            <div.icon size={28} />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{div.name} Division</h3>
                                    <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider font-semibold">ISO Documentation</p>
                                    <div className="flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                        View Files <ChevronRight size={16} className="ml-1" />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {isDirector && (
                            <button 
                                onClick={() => setActiveDivision(null)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors mb-4"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180" />
                                Back to Divisions
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

            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={logout}
                userEmail={user?.email || ''}
            />
        </div>
    );
}
