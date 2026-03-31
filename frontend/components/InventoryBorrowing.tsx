import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, History, ShieldCheck } from 'lucide-react';
import { BorrowingForm } from './BorrowingForm';
import { BorrowingStatusList } from './BorrowingStatusList';

export function InventoryBorrowing() {
  const [activeTab, setActiveTab] = useState<'form' | 'status'>('form');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 pb-6 border-b border-slate-700/30">
        
        <div className="grid grid-cols-2 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden w-full md:w-auto">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
              activeTab === 'form'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="truncate">Buat Pengajuan</span>
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
              activeTab === 'status'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="truncate">Status Peminjaman</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'form' ? (
            <motion.div
              key="form-container"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="max-w-3xl mx-auto"
            >
               <BorrowingForm onSuccess={() => setActiveTab('status')} />
            </motion.div>
          ) : (
            <motion.div
              key="status-container"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="mb-8">
                 {/* Card 2: Prosedur */}
                 <div className="p-5 md:p-8 bg-slate-900 ring-1 ring-slate-800/50 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border-l-4 border-l-emerald-500 flex flex-col gap-4 shadow-2xl hover:bg-slate-800/50 transition-all max-w-2xl mx-auto">
                    <div className="flex items-center gap-2.5">
                       <div className="p-2.5 bg-emerald-500/10 rounded-2xl">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                       </div>
                       <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.25em]">Prosedur Peminjaman</p>
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-base md:text-lg font-black text-slate-100 uppercase tracking-tight">E-Signature Sah & Resmi</h4>
                       <p className="text-xs md:text-sm font-medium text-slate-400 leading-relaxed">
                          Sertakan <span className="text-emerald-400 font-bold underline underline-offset-4 decoration-emerald-500/30">tanda tangan digital</span> yang sah secara resmi saat proses pengembalian barang ke inventory UTT untuk validasi data.
                       </p>
                    </div>
                 </div>
              </div>
              <BorrowingStatusList />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
