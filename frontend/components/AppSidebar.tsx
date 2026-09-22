// ============================================================================
// FILE: frontend/components/AppSidebar.tsx
// Deskripsi: Sidebar Navigasi Utama DwimitraSystem untuk Semua Peranan & Akun
//            (Admin, QC DME, Engineer, Standby Engineer, User DME, Auditor).
//            Menyediakan navigasi terklasifikasi logis, mode Collapsible desktop,
//            dan Drawer samping kiri responsif untuk layar seluler.
// ============================================================================

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  LucideIcon,
} from 'lucide-react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import { User } from 'firebase/auth';

export interface NavItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  show: boolean;
}

interface AppSidebarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  navItems: readonly NavItemDef[];
  pendingDeleteCount: number;
  totalAbnormalCount: number;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

// Pengelompokan / Klasifikasi menu logis komprehensif untuk seluruh role
const MENU_SECTIONS = [
  {
    title: 'Monitoring & Kontrol',
    itemIds: ['admin', 'delete_requests', 'abnormal_findings', 'manual_abnormal', 'findings', 'finding_archive'],
  },
  {
    title: 'Operasional & K3',
    itemIds: ['absen_tbm', 'absen_induction', 'ptw', 'corrective', 'corrective_archive', 'hse_archive'],
  },
  {
    title: 'Dokumentasi & Laporan',
    itemIds: ['report', 'arsip_dokumen', 'documents', 'pir', 'monthly_report', 'berita_acara'],
  },
  {
    title: 'Standar & Aset',
    itemIds: ['sop_eop', 'boq', 'pm_schedule', 'face_registration'],
  },
];

export function AppSidebar({
  user,
  activeTab,
  setActiveTab,
  navItems,
  pendingDeleteCount,
  totalAbnormalCount,
  isCollapsed,
  setIsCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogoutClick,
}: AppSidebarProps) {
  const visibleItems = navItems.filter((i) => i.show);

  // Helper untuk merender tombol item navigasi
  const renderNavButton = (item: NavItemDef, isMobile: boolean = false) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          if (isMobile) setMobileMenuOpen(false);
        }}
        title={isCollapsed && !isMobile ? item.label : undefined}
        className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
          isCollapsed && !isMobile ? 'justify-center px-0' : ''
        } ${
          isActive
            ? `bg-gradient-to-r ${item.color} text-white shadow-md shadow-blue-500/20 font-bold`
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <div className="relative shrink-0 flex items-center justify-center">
          <Icon
            className={`w-4 h-4 transition-transform group-hover:scale-105 ${
              isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'
            }`}
          />
          {/* Titik indikator saat sidebar diciutkan (collapsed) */}
          {isCollapsed && !isMobile && (
            <>
              {item.id === 'delete_requests' && pendingDeleteCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
              {item.id === 'abnormal_findings' && totalAbnormalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white" />
              )}
            </>
          )}
        </div>

        {/* Label & Badge saat sidebar terbuka atau di mobile */}
        {(!isCollapsed || isMobile) && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate tracking-tight">{item.label}</span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {item.id === 'delete_requests' && pendingDeleteCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-xs ${
                    isActive ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                  }`}
                >
                  {pendingDeleteCount}
                </span>
              )}
              {item.id === 'abnormal_findings' && totalAbnormalCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-xs ${
                    isActive ? 'bg-amber-300 text-slate-900' : 'bg-amber-400 text-rose-950'
                  }`}
                >
                  {totalAbnormalCount}
                </span>
              )}
            </div>
          </div>
        )}
      </button>
    );
  };

  // Render navigasi dengan klasifikasi kategori yang rapi & elegan
  const renderNavSections = (isMobile: boolean = false) => {
    return (
      <div className="space-y-4">
        {MENU_SECTIONS.map((section, idx) => {
          const sectionItems = visibleItems.filter((i) => section.itemIds.includes(i.id));
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {/* Header Klasifikasi / Kategori Menu */}
              {(!isCollapsed || isMobile) ? (
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  {section.title}
                </div>
              ) : (
                idx > 0 && <div className="mx-3 my-2 border-t border-slate-100" />
              )}

              <div className="space-y-0.5">
                {sectionItems.map((item) => renderNavButton(item, isMobile))}
              </div>
            </div>
          );
        })}

        {/* Item cadangan di luar klasifikasi jika ada */}
        {(() => {
          const allSectionIds = MENU_SECTIONS.flatMap((s) => s.itemIds);
          const leftoverItems = visibleItems.filter((i) => !allSectionIds.includes(i.id));
          if (leftoverItems.length === 0) return null;

          return (
            <div className="space-y-1">
              {(!isCollapsed || isMobile) ? (
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  Lainnya
                </div>
              ) : (
                <div className="mx-3 my-2 border-t border-slate-100" />
              )}
              <div className="space-y-0.5">
                {leftoverItems.map((item) => renderNavButton(item, isMobile))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <>
      {/* ────────────────────────────────────────────────────────────────────────
          1. DESKTOP SIDEBAR (Permanent Left Side - Clean Classified White Theme)
          ──────────────────────────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-xs transition-all duration-300 ease-in-out z-40 ${
          isCollapsed ? 'w-20' : 'w-80'
        }`}
      >
        {/* Header Sidebar (Logo Perusahaan Asli + Nama PT Dwimitra + Tombol Ciutkan) */}
        <div
          className={`border-b border-slate-200/80 bg-white shrink-0 transition-all duration-200 ${
            isCollapsed
              ? 'p-3 flex flex-col items-center gap-2.5'
              : 'px-3.5 py-3.5 flex items-center justify-between gap-2'
          }`}
        >
          {isCollapsed ? (
            <>
              <img
                src={logoDwimitra}
                alt="PT Dwimitra Ekatama Mandiri"
                className="w-8 h-8 object-contain"
              />
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                title="Perluas Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                  src={logoDwimitra}
                  alt="PT Dwimitra Ekatama Mandiri"
                  className="w-9 h-9 object-contain shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-[12.5px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight"
                    title="PT Dwimitra Ekatama Mandiri"
                  >
                    PT Dwimitra Ekatama Mandiri
                  </h2>
                  <p
                    className="text-[10.5px] text-slate-500 font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis mt-0.5"
                    title="Sistem Pemeliharaan Data Center"
                  >
                    Sistem Pemeliharaan Data Center
                  </p>
                </div>
              </div>

              {/* Tombol Toggle Collapse / Expand */}
              <button
                onClick={() => setIsCollapsed(true)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-all cursor-pointer shrink-0"
                title="Ciutkan Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Tengah: Daftar Menu Terklasifikasi (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          {renderNavSections(false)}
        </div>
      </aside>

      {/* ────────────────────────────────────────────────────────────────────────
          2. MOBILE DRAWER OVERLAY (Layar Smartphone / Tablet Kecil)
          ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop Gelap Halus */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] md:hidden"
            />

            {/* Panel Drawer Samping Kanan (Mobile) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-[290px] sm:w-[320px] bg-white border-l border-slate-200 z-[80] md:hidden flex flex-col shadow-2xl"
            >
              {/* Header Mobile Drawer */}
              <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <img src={logoDwimitra} alt="PT Dwimitra Ekatama Mandiri" className="w-8 h-8 object-contain shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                      PT Dwimitra Ekatama Mandiri
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                      Sistem Pemeliharaan Data Center
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Tutup Menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Info User */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Terhubung sebagai</p>
                  <p className="text-xs font-semibold text-slate-700 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Daftar Menu Terklasifikasi Scrollable */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {renderNavSections(true)}
              </div>

              {/* Tombol Logout Mobile Di Dalam Sidebar */}
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogoutClick();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 font-bold text-xs transition-all shadow-xs cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Sesi</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
