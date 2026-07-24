import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, FileDown, Info, FileType, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { useAuth } from '@/components/AuthContext';

interface PhotoCard {
    id: string;
    photo: File | null;
    photoBase64?: string;
    description: string;
}

interface PreviewReportProps {
    maintenanceName: string;
    maintenanceTime: string;
    specificDetail: string;
    cards: PhotoCard[];
    companyType: 'neutra' | 'bri';
    userEmail: string;
    onBack: () => void;
    onExport: () => void;
}

export function PreviewReport({
    maintenanceName,
    maintenanceTime,
    specificDetail,
    cards,
    companyType,
    userEmail,
    onBack,
    onExport
}: PreviewReportProps) {
    const { userRole } = useAuth();
    const isDME = userRole === 'DME';
    const isATS = userEmail === 'ats@gmail.com';
    const isPDU = userEmail === 'pdu@gmail.com';
    const isLV = userEmail === 'lv@gmail.com';
    const isLDBRDB = userEmail === 'ldb/rdb@gmail.com';
    const isVRV = userEmail === 'vrv@gmail.com';
    const isLightingSystem = userEmail.toLowerCase() === 'lightingsystem@gmail.com';
    const isACSplit = userEmail === 'acsplit@gmail.com';
    const isCRAC = userEmail === 'crac@gmail.com';
    const isWLD = userEmail === 'wld@gmail.com';
    const isFLD = userEmail === 'fld@gmail.com';
    const isPJU = userEmail === 'pju@gmail.com';
    const isPump = userEmail === 'pump@gmail.com';
    const isMV = userEmail === 'mv@gmail.com';
    const isSmallGrid = isPDU || isLV || isLDBRDB || isVRV || isATS || isLightingSystem || isACSplit || isCRAC || isWLD || isFLD || isPJU || isPump || isMV;
    const isLVlike = isLV || isLDBRDB || isLightingSystem;

    const columns = (isVRV || isATS || isACSplit || isCRAC || isWLD || isFLD || isPJU || isPump || isMV) ? 3 : isSmallGrid ? 4 : 3;
    const perPage = (isATS || isACSplit || isCRAC || isPJU || isPump || isMV) ? 12 : isPDU ? 20 : isLVlike ? 12 : isVRV ? 15 : 9;
    const filledCards = cards.filter(card => card.photoBase64 || card.description);
    const [acknowledged, setAcknowledged] = useState(false);

    const formattedDate = new Date(maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
    const rightLogo = companyType === 'bri' ? logoBRI : logoNeutraDC;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-6xl mx-auto pb-20"
        >
            <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-white/10 shadow-2xl overflow-hidden">
                <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
                    <AnimatePresence>
                        {!acknowledged && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 overflow-hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                                        <Info className="w-4 h-4 text-white" />
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-white leading-tight font-medium">
                                        <span className="font-bold underline">INFO:</span> Khusus HP, silakan <b>geser ke samping</b> pada kertas laporan di bawah untuk melihat detail lebar penuh.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAcknowledged(true)}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold rounded-lg transition"
                                >
                                    Paham
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onBack}
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/50 transition-all font-bold text-sm active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>{isDME ? 'Kembali' : 'Kembali & Edit'}</span>
                        </button>

                        <button
                            onClick={onExport}
                            className="flex-1 flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xl shadow-red-500/20 transition-all text-sm active:scale-95"
                        >
                            <FileDown className="w-5 h-5" />
                            <span>{isDME ? 'Export PDF' : 'Export & Simpan'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="sm:hidden flex justify-center mt-6 animate-pulse">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider">
                    <span>Geser Kertas</span>
                    <ChevronRight className="w-3 h-3" />
                </div>
            </div>

            <div className="w-full overflow-x-auto mt-6 pb-12 px-4 custom-scrollbar">
                <div className="bg-white shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-8 sm:p-14 text-slate-900 min-h-[1162px] font-sans border border-slate-200 rounded-sm mx-auto w-[900px]">
                    <div className="flex items-center justify-between pb-6 mb-8 mt-2">
                        <div className="w-[110px] flex-shrink-0">
                            <img src={leftLogo} alt="Logo Left" className={isPDU ? "h-10 w-auto" : "h-20 w-auto object-contain"} />
                        </div>
                        <div className="text-center flex-1 mx-4 max-w-[500px] overflow-hidden">
                            <h1 className="text-blue-600 font-bold text-base sm:text-lg tracking-tight uppercase mb-1">
                                Laporan Maintenance
                            </h1>
                            <h2 className={`font-bold uppercase tracking-tighter text-slate-800 break-words ${isPDU ? "text-[10px]" : "text-[15px]"}`}>
                                Dokumentasi PM: {maintenanceName}
                            </h2>
                            {specificDetail && (
                                <p className={`mt-0.5 font-bold text-blue-600 uppercase tracking-widest break-words ${isPDU ? "text-[8px]" : "text-[13px]"}`}>
                                    {specificDetail}
                                </p>
                            )}
                            <p className={`mt-1 text-slate-500 font-medium ${isPDU ? "text-[8px]" : "text-[11px]"}`}>
                                Tanggal Maintenance: {formattedDate}
                            </p>
                        </div>
                        <div className="w-[110px] flex-shrink-0 flex justify-end">
                            <img src={rightLogo} alt="Logo Right" className={isPDU ? "h-10 w-auto" : "h-14 w-auto object-contain"} />
                        </div>
                    </div>

                    <div className="h-px w-full bg-slate-100 mb-8" />

                    <div
                        className={`grid gap-3 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
                    >
                        {filledCards.map((card, index) => (
                            <div key={card.id || index} className="flex flex-col border-2 border-slate-900 overflow-hidden shadow-sm">
                                <div className={`relative overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border-b-2 border-slate-900 ${(isVRV || isWLD || isFLD) ? 'h-[200px]' : isSmallGrid ? 'h-[150px]' : 'h-[210px]'}`}>
                                    {card.photoBase64 ? (
                                        <img src={card.photoBase64} alt={`Doc ${index + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                            <FileType className="w-8 h-8 opacity-20" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">No Image</span>
                                        </div>
                                    )}

                                </div>
                                <div className="p-2 bg-white min-h-[50px] flex items-center gap-2 text-left relative">
                                    <div className="absolute left-1 top-2 bottom-2 w-[2px] bg-blue-600 rounded-full" />
                                    <p className="text-[12px] leading-tight text-slate-900 font-bold break-words pl-2 pr-1">
                                        {card.description || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filledCards.length > perPage && (
                        <div className="mt-12 border-t-4 border-dotted border-slate-200 flex justify-center">
                            <span className="bg-slate-50 px-4 py-1.5 text-[11px] text-slate-400 font-black uppercase tracking-widest -mt-4 border-2 border-slate-100 rounded-full">
                                NEXT PAGE
                            </span>
                        </div>
                    )}

                    <div className="mt-24 border-t-2 border-slate-100 pt-12 pb-6 text-center">
                        <p className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-black">
                            PT DWIMITRA EKATAMA MANDIRI • OFFICIAL PM REPORT
                        </p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(79, 70, 229, 0.4);
                    border-radius: 10px;
                }
            ` }} />
        </motion.div>
    );
}

