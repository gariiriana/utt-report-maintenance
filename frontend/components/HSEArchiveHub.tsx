// ============================================================================
// FILE: HSEArchiveHub.tsx
// Deskripsi: Modul Terpadu Arsip K3 & HSE (HSE & Safety Archive Hub).
//            Menggabungkan Arsip Temuan K3 (HSE Findings Archive) dan
//            Arsip Dokumen HSE (Laporan Inspeksi HSE) ke dalam satu tampilan
//            navigasi terpadu dengan sub-tab pill switcher responsif & modern.
// ============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, FolderArchive, HardHat } from 'lucide-react';
import { HSEFindingsArchive } from './HSEFindingsArchive';
import { DocumentList, ExcelDocument } from './DocumentList';

interface HSEArchiveHubProps {
  onEdit?: (doc: ExcelDocument) => void;
  initialSearchQuery?: string;
}

export function HSEArchiveHub({ onEdit, initialSearchQuery }: HSEArchiveHubProps) {
  // State sub-tab aktif: 'findings' untuk Arsip Temuan K3, 'documents' untuk Arsip Dokumen HSE
  const [activeSubTab, setActiveSubTab] = useState<'findings' | 'documents'>('findings');

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Utama Modul Arsip K3 & HSE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-md shadow-emerald-500/20 shrink-0">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                Arsip K3 & HSE
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                Health, Safety & Environment
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Dokumentasi Keselamatan, Kesehatan Kerja & Lingkungan — Arsip Temuan K3 dan Laporan Inspeksi HSE
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tab Switcher Pills (Mengadopsi Desain Elegan Arsip Standby) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 border-b border-slate-200/80 pb-4 w-full">
        {/* Tombol Sub-Tab 1: Arsip Temuan K3 */}
        <button
          type="button"
          onClick={() => setActiveSubTab('findings')}
          className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition cursor-pointer border whitespace-nowrap shadow-2xs ${
            activeSubTab === 'findings'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Arsip Temuan K3</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'findings' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            Temuan Lapangan
          </span>
        </button>

        {/* Tombol Sub-Tab 2: Arsip Dokumen HSE */}
        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition cursor-pointer border whitespace-nowrap shadow-2xs ${
            activeSubTab === 'documents'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FolderArchive className="w-4 h-4 shrink-0" />
          <span>Arsip Dokumen HSE</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'documents' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
            }`}
          >
            Laporan Inspeksi
          </span>
        </button>
      </div>

      {/* Area Konten Dinamis Berdasarkan Sub-Tab Aktif */}
      <div className="w-full flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {activeSubTab === 'findings' ? (
            <motion.div
              key="hse-findings-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <HSEFindingsArchive />
            </motion.div>
          ) : (
            <motion.div
              key="hse-documents-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <DocumentList
                filterOverride="hse_utt"
                onEdit={onEdit}
                initialSearchQuery={initialSearchQuery}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
