// ============================================================================
// FILE: BOQMasterAsset.tsx
// Deskripsi: Modul Master Asset & Bill of Quantities (BOQ) DwimitraSystem.
//            Menampilkan data inventaris aset critical facility (35 sub-sistem)
//            dan inventaris spareparts & consumables (20 sub-sistem) dari NeutraDC Cikarang.
//            Mendukung pencarian instan, filter sistem, paginasi, modal datasheet detail,
//            sub-tabel baterai UPS, dan ekspor data ke Excel (.xlsx).
// ============================================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Search,
  Download,
  Layers,
  Zap,
  Fuel,
  ShieldAlert,
  Wind,
  Flame,
  Wrench,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  FileSpreadsheet,
  Info,
  Building2,
  Cpu,
  Boxes
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  BOQCategory,
  BOQItem,
  BOQ_CATEGORIES_DATA,
  BOQ_GROUPS
} from '@/data/boqAssetData';

// Map icon string ke Lucide Component
const GROUP_ICONS: Record<string, React.ElementType> = {
  Layers,
  Zap,
  Fuel,
  ShieldAlert,
  Wind,
  Flame,
  Building2,
  Wrench,
};

export function BOQMasterAsset() {
  // State Filter & Navigasi
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(BOQ_CATEGORIES_DATA[0]?.id || 'cat_1');
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // State Modal Detail Datasheet
  const [selectedItem, setSelectedItem] = useState<{ category: BOQCategory; item: BOQItem } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter Kategori berdasarkan Group dan Search Query Kategori
  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.toLowerCase().trim();
    return BOQ_CATEGORIES_DATA.filter((cat) => {
      const matchesGroup = selectedGroup === 'all' || cat.group === selectedGroup;
      if (!matchesGroup) return false;
      if (!q) return true;
      return (
        cat.name.toLowerCase().includes(q) ||
        cat.group.toLowerCase().includes(q) ||
        (cat.id && cat.id.toLowerCase().includes(q))
      );
    });
  }, [selectedGroup, categorySearchQuery]);

  // Pastikan kategori yang dipilih valid setelah filter berubah
  const activeCategory = useMemo(() => {
    const found = BOQ_CATEGORIES_DATA.find((c) => c.id === selectedCategoryId);
    if (found) return found;
    return filteredCategories[0] || BOQ_CATEGORIES_DATA[0];
  }, [selectedCategoryId, filteredCategories]);

  // Filter Items di dalam Kategori aktif berdasarkan Search Query
  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    if (!searchQuery.trim()) return activeCategory.items;

    const q = searchQuery.toLowerCase().trim();
    return activeCategory.items.filter((item) => {
      return Object.values(item).some((val) => val && String(val).toLowerCase().includes(q));
    });
  }, [activeCategory, searchQuery]);

  // Paginasi Items
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    if (itemsPerPage === -1) return filteredItems;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Handler Ganti Kategori
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setCurrentPage(1);
    setSearchQuery('');
  };

  // Handler Copy Text ke Clipboard
  const handleCopy = (text: string, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    toast.success(`Disalin: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Handler Export Kategori Aktif ke Excel (.xlsx)
  const handleExportCurrentSheet = () => {
    if (!activeCategory) return;
    try {
      const ws = XLSX.utils.json_to_sheet(activeCategory.items);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeCategory.name.slice(0, 31));

      // Jika ada side table baterai
      if (activeCategory.sideTable) {
        const sideWs = XLSX.utils.json_to_sheet(activeCategory.sideTable.rows);
        XLSX.utils.book_append_sheet(wb, sideWs, 'Battery Breakdown');
      }

      const fileName = `BOQ_${activeCategory.name.replace(/[^a-zA-Z0-9]/g, '_')}_NeutraDC.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Berhasil mengunduh Excel: ${fileName}`, { icon: '📊' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor file Excel');
    }
  };

  // Handler Export Semua 55 Kategori ke 1 File Excel Multi-Sheet
  const handleExportAllSheets = () => {
    try {
      const wb = XLSX.utils.book_new();
      BOQ_CATEGORIES_DATA.forEach((cat) => {
        const sheetName = cat.name.slice(0, 31).replace(/[\/\\?*[\]]/g, '_');
        const ws = XLSX.utils.json_to_sheet(cat.items);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      const fileName = `Master_Asset_BOQ_NeutraDC_Cikarang_All_Sheets.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Berhasil mengunduh Master Excel (${BOQ_CATEGORIES_DATA.length} Kategori)`, { icon: '📦' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor file Excel lengkap');
    }
  };

  // Metrik Ringkas
  const totalAssetsCount = useMemo(
    () => BOQ_CATEGORIES_DATA.reduce((acc, c) => acc + c.itemCount, 0),
    []
  );

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Hero / Header Card Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-400/30 text-sky-200 text-xs font-semibold backdrop-blur-md mb-3">
                <Database className="w-3.5 h-3.5 text-sky-300" />
                <span>Asset Inventory & Bill of Quantities (BOQ)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Master Asset & BOQ Maintenance
              </h1>
              <p className="text-sm text-sky-200/90 mt-1 max-w-2xl leading-relaxed">
                Database terpadu seluruh aset critical facility dan inventaris inspeksi 
                PT Dwimitra Ekatama Mandiri di NeutraDC Cikarang.
              </p>
            </div>

            {/* Quick Action Export Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportCurrentSheet}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs sm:text-sm font-bold text-white backdrop-blur-md shadow-sm transition cursor-pointer"
                title="Ekspor tab yang sedang aktif"
              >
                <Download className="w-4 h-4 text-sky-300" />
                <span>Export Tab Ini (.xlsx)</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportAllSheets}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/30 transition cursor-pointer"
                title={`Ekspor seluruh ${BOQ_CATEGORIES_DATA.length} kategori ke dalam 1 file Excel`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>Export Semua ({BOQ_CATEGORIES_DATA.length} Kategori)</span>
              </motion.button>
            </div>
          </div>

          {/* Quick Stats Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-sky-800/60">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold mb-1">
                <Boxes className="w-4 h-4" />
                <span>Total Kategori Fasilitas</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {BOQ_CATEGORIES_DATA.length} <span className="text-xs font-normal text-sky-200">Kategori</span>
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold mb-1">
                <Cpu className="w-4 h-4" />
                <span>Total Aset Critical Facility</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                {totalAssetsCount.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-emerald-200">unit</span>
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold mb-1">
                <Building2 className="w-4 h-4" />
                <span>Worksheet Checklist</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-cyan-300">
                38 <span className="text-xs font-normal text-cyan-200">Sheet Tabs Terverifikasi</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Filter Bar Navigasi Grup Sistem */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {BOQ_GROUPS.map((grp) => {
              const IconComp = GROUP_ICONS[grp.icon] || Layers;
              const isSelected = selectedGroup === grp.id;
              const countInGroup =
                grp.id === 'all'
                  ? BOQ_CATEGORIES_DATA.length
                  : BOQ_CATEGORIES_DATA.filter((c) => c.group === grp.id).length;

              return (
                <button
                  key={grp.id}
                  onClick={() => {
                    setSelectedGroup(grp.id);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-transparent shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                  <span>{grp.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {countInGroup}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Baris Pemilihan Kategori / Sheet Tab */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* Sidebar / Grid Daftar Kategori Sheet */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Kategori ({filteredCategories.length})
                </h2>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  Inspection Sheet
                </span>
              </div>

              {/* Input Search Kategori */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Cari kategori (misal: Trafo, ATS, Panel)..."
                  className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl outline-none transition placeholder:text-slate-400"
                />
                {categorySearchQuery && (
                  <button
                    onClick={() => setCategorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* List Scrollable Kategori Sheet Tabs */}
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredCategories.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Kategori tidak ditemukan</p>
                    {categorySearchQuery && (
                      <button
                        onClick={() => setCategorySearchQuery('')}
                        className="mt-1.5 text-[11px] text-blue-600 hover:underline font-bold cursor-pointer"
                      >
                        Reset pencarian
                      </button>
                    )}
                  </div>
                ) : (
                  filteredCategories.map((cat, idx) => {
                  const isActive = activeCategory?.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-blue-50/90 border-blue-300 text-blue-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs truncate leading-snug">{cat.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {cat.group}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ml-2 ${
                          isActive
                            ? 'bg-blue-200 text-blue-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cat.itemCount}
                      </span>
                    </button>
                  );
                }))}
              </div>
            </div>
          </div>

          {/* Kolom Tabel Data & Detail Kategori Terpilih */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {activeCategory && (
              <>
                {/* Header Info Sheet Terpilih + Search Bar */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                          {activeCategory.name}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            activeCategory.isSparepart
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {activeCategory.isSparepart ? 'Spareparts & Consumables' : 'Aset Critical Facility'}
                        </span>
                      </div>
                      {activeCategory.titles.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {activeCategory.titles.join(' • ')}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400">Total Baris:</span>
                      <p className="text-lg font-extrabold text-blue-600">
                        {filteredItems.length}{' '}
                        <span className="text-xs font-medium text-slate-500">
                          / {activeCategory.itemCount} data
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Universal Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder={`Cari dalam sheet ${activeCategory.name} (nama, serial number, tag, ruangan, lantai, dll)...`}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabel Data Interaktif */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                  <div className="overflow-x-auto max-h-[560px] scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider backdrop-blur-xs">
                        <tr>
                          {activeCategory.headers.map((h, i) => (
                            <th key={i} className="py-3 px-3.5 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeCategory.headers.length}
                              className="text-center py-12 text-slate-400 text-sm"
                            >
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Search className="w-8 h-8 text-slate-300" />
                                <p className="font-semibold text-slate-600">Tidak ada data yang cocok</p>
                                <p className="text-xs text-slate-400">
                                  Coba ubah kata kunci pencarian pada kotak di atas.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedItems.map((row, rowIdx) => {
                            return (
                              <tr
                                key={rowIdx}
                                onClick={() => setSelectedItem({ category: activeCategory, item: row })}
                                className="hover:bg-blue-50/60 transition cursor-pointer group"
                              >
                                {activeCategory.headers.map((h, colIdx) => {
                                  const cellVal = row[h] || '-';
                                  const isImportantCol =
                                    h.toLowerCase().includes('ci name') ||
                                    h.toLowerCase().includes('description') ||
                                    h.toLowerCase() === 'no';

                                  return (
                                    <td
                                      key={colIdx}
                                      className={`py-2.5 px-3.5 whitespace-nowrap text-slate-700 ${
                                        isImportantCol ? 'font-semibold text-slate-900' : ''
                                      }`}
                                    >
                                      {/* Visual Badges for Specific Fields */}
                                      {h === 'Floor' && cellVal !== '-' ? (
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                                          {cellVal}
                                        </span>
                                      ) : h === 'Room' && cellVal !== '-' ? (
                                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-medium text-[10px]">
                                          {cellVal}
                                        </span>
                                      ) : h === 'Capacity' && cellVal !== '-' && cellVal !== '' ? (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                                          {cellVal}
                                        </span>
                                      ) : (
                                        <span>{cellVal}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginasi & Baris per Halaman */}
                  <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span>Tampilkan:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={-1}>Semua ({filteredItems.length})</option>
                      </select>
                      <span>dari total {filteredItems.length} baris</span>
                    </div>

                    {itemsPerPage !== -1 && totalPages > 1 && (
                      <div className="flex items-center gap-1 self-center sm:self-auto">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 font-semibold text-slate-700">
                          Halaman {currentPage} dari {totalPages}
                        </span>

                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Tabel Baterai UPS (Jika Ada) */}
                {activeCategory.sideTable && (
                  <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {activeCategory.sideTable.title}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-amber-50/80 border-b border-amber-200 text-amber-900 font-bold uppercase text-[10px]">
                          <tr>
                            {activeCategory.sideTable.headers.map((h, i) => (
                              <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeCategory.sideTable.rows.map((r, i) => (
                            <tr key={i} className="hover:bg-amber-50/40">
                              <td className="py-2 px-3 font-bold text-slate-600">{r.no}</td>
                              <td className="py-2 px-3 font-medium text-slate-900">{r.description}</td>
                              <td className="py-2 px-3 font-extrabold text-blue-700">{r.qty}</td>
                              <td className="py-2 px-3 text-slate-600">{r.unit}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                                  {r.category}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Catatan Validasi & Pengesahan Dokumen */}
                {activeCategory.signatures.length > 0 && (
                  <div className="bg-sky-50/60 rounded-2xl p-4 border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
                    <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sky-950 mb-1">Catatan Pengesahan Dokumen Sheet:</p>
                      {activeCategory.signatures.map((sig, i) => (
                        <p key={i} className="text-slate-600">
                          {sig}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Detail Datasheet Aset */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 max-w-2xl mx-auto top-[8%] bottom-[8%] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden"
            >
              {/* Header Modal */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold mb-1">
                    <Database className="w-3.5 h-3.5" />
                    <span>Datasheet Item — {selectedItem.category.name}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold truncate">
                    {selectedItem.item['CI Name*'] ||
                      selectedItem.item['CI Name'] ||
                      selectedItem.item['DESCRIPTION'] ||
                      'Detail Spesifikasi'}
                  </h3>
                  <p className="text-xs text-sky-200/80 truncate">
                    {selectedItem.item['CI Description*'] ||
                      selectedItem.item['Class Id'] ||
                      selectedItem.category.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedItem.category.headers.map((h, i) => {
                    const val = selectedItem.item[h] || '-';
                    return (
                      <div
                        key={i}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between group hover:border-blue-300 transition"
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {h}
                        </span>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs font-semibold text-slate-800 break-words">
                            {val}
                          </span>
                          {val !== '-' && val !== '' && (
                            <button
                              onClick={() => handleCopy(val, h)}
                              className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              title={`Salin ${h}`}
                            >
                              {copiedKey === h ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Critical Facility NeutraDC Cikarang
                </span>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup Datasheet
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
