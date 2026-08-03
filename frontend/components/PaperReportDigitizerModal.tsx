import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, UploadCloud, FileText, CheckCircle2, Plus, Trash2, X, RefreshCw, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { digitizePaperReportAI, DigitizedPaperReportResult } from '@/utils/aiAgentPipeline';
import { generateDigitizedPaperDOCX } from '@/utils/generateDigitizedPaperDOCX';

interface PaperReportDigitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountEmail?: string;
  onApplyToForm?: (result: DigitizedPaperReportResult) => void;
}

export function PaperReportDigitizerModal({
  isOpen,
  onClose,
  accountEmail
}: PaperReportDigitizerModalProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DigitizedPaperReportResult | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers: Promise<string>[] = Array.from(files).map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(base64Photos => {
      setSelectedPhotos(prev => [...prev, ...base64Photos]);
      toast.success(`${base64Photos.length} foto kertas berhasil dimuat!`);
    }).catch(err => {
      console.error(err);
      toast.error('Gagal membaca file foto');
    });
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartScan = async () => {
    if (selectedPhotos.length === 0) {
      toast.error('Pilih/upload minimal 1 foto lembaran service report fisik');
      return;
    }

    setIsScanning(true);
    const toastId = toast.loading('AI Gemini Vision sedang membaca & mendigitalisasi tabel kertas...');

    try {
      const res = await digitizePaperReportAI(selectedPhotos, accountEmail);
      setScanResult(res);
      toast.success('Digitalisasi Laporan & Tabel Berhasil!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal mendigitalisasi laporan: ${err?.message || 'Terjadi kesalahan AI'}`, { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCellChange = (tableIndex: number, rowIndex: number, colIndex: number, newValue: string) => {
    if (!scanResult) return;
    const newTables = [...scanResult.tables];
    const newRows = [...newTables[tableIndex].rows];
    const newRow = [...newRows[rowIndex]];
    newRow[colIndex] = newValue;
    newRows[rowIndex] = newRow;
    newTables[tableIndex].rows = newRows;

    setScanResult({
      ...scanResult,
      tables: newTables
    });
  };

  const handleAddRow = (tableIndex: number) => {
    if (!scanResult) return;
    const newTables = [...scanResult.tables];
    const headersCount = newTables[tableIndex].headers.length;
    const emptyRow = new Array(headersCount).fill('');
    emptyRow[0] = String(newTables[tableIndex].rows.length + 1);
    newTables[tableIndex].rows.push(emptyRow);

    setScanResult({
      ...scanResult,
      tables: newTables
    });
    toast.info('Baris tabel ditambahkan');
  };

  const handleDeleteRow = (tableIndex: number, rowIndex: number) => {
    if (!scanResult) return;
    const newTables = [...scanResult.tables];
    newTables[tableIndex].rows.splice(rowIndex, 1);
    setScanResult({
      ...scanResult,
      tables: newTables
    });
    toast.info('Baris tabel dihapus');
  };

  const [isGeneratingDOCX, setIsGeneratingDOCX] = useState(false);

  const handleExportDOCX = async () => {
    if (!scanResult) return;
    setIsGeneratingDOCX(true);
    try {
      await generateDigitizedPaperDOCX(scanResult);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGeneratingDOCX(false);
    }
  };

  const handleCopyText = () => {
    if (!scanResult) return;
    let text = `=== ${scanResult.title} ===\n\n`;
    if (scanResult.equipment_info) {
      text += `--- INFO UTAMA ---\n`;
      Object.entries(scanResult.equipment_info).forEach(([k, v]) => {
        text += `${k}: ${v}\n`;
      });
      text += `\n`;
    }
    scanResult.tables.forEach((t) => {
      text += `--- ${t.table_name} ---\n`;
      text += `${t.headers.join(' | ')}\n`;
      t.rows.forEach(r => {
        text += `${r.join(' | ')}\n`;
      });
      text += `\n`;
    });
    navigator.clipboard.writeText(text);
    toast.success('Teks terdigitalisasi berhasil disalin ke clipboard!');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-sky-200 overflow-hidden my-auto max-h-[92vh] flex flex-col font-geist"
        >
          {/* Header Bar - DME Signature Blue */}
          <div className="bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white p-4 sm:p-6 flex items-center justify-between shadow-md relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-500/20 backdrop-blur-md border border-sky-400/30 rounded-2xl text-sky-300">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">
                    AI Agent Service Report Digitizer
                  </h2>
                  <span className="bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-full">
                    DME OCR Vision
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-sky-200/80 mt-0.5 font-medium">
                  Scan foto lembaran fisik / tulisan tangan & ubah menjadi tabel digital terstruktur khas logo DME
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-sky-200 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

            {/* STEP 1: Upload & Photo Selection */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    Upload Foto Kertas Laporan Service Report
                  </h3>
                  <p className="text-xs text-slate-500">
                    Foto lembaran fisik terisi tulisan tangan atau form cetak dari lapangan
                  </p>
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95">
                  <Plus className="w-4 h-4" />
                  <span>Tambah Foto Kertas</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Photo Thumbnails */}
              {selectedPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-3">
                  {selectedPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-300 bg-white aspect-[4/3] shadow-sm">
                      <img src={photo} alt={`Kertas ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPreviewPhoto(photo)}
                          className="p-1.5 bg-white/90 text-slate-800 rounded-lg hover:bg-white transition"
                          title="Lihat Foto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemovePhoto(idx)}
                          className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          title="Hapus Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white/60">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-bold">Belum ada foto kertas yang dipilih</p>
                  <p className="text-[11px] text-slate-400 mt-1">Klik tombol "Tambah Foto Kertas" di atas untuk memulai scan OCR</p>
                </div>
              )}

              {/* Action Button: Scan */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleStartScan}
                  disabled={isScanning || selectedPhotos.length === 0}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg transition ${
                    isScanning || selectedPhotos.length === 0
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 shadow-blue-500/25 active:scale-95'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses OCR Gemini Vision...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Mulai Digitalisasi AI & Buat Tabel</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* STEP 2: Digitized Results Display (DME Blue Theme Tables) */}
            {scanResult && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      {scanResult.title || 'Hasil Digitalisasi Service Report Fisik'}
                    </h3>
                    <p className="text-xs text-slate-500">{scanResult.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyText}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-slate-200"
                    >
                      <Copy className="w-3.5 h-3.5" /> Salin Teks
                    </button>
                    <button
                      onClick={handleExportDOCX}
                      disabled={isGeneratingDOCX}
                      className="px-4 py-1.5 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> Export Word (DOCX)
                    </button>
                  </div>
                </div>

                {/* Equipment / Header Info */}
                {scanResult.equipment_info && Object.keys(scanResult.equipment_info).length > 0 && (
                  <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-sky-900 mb-2">
                      📋 Info Umum & Peralatan Hasil Scan
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                      {Object.entries(scanResult.equipment_info).map(([key, val], idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-sky-100 shadow-sm">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">{key}</span>
                          <span className="font-bold text-slate-800 truncate block mt-0.5">{val || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digitized Tables with DME Blue Style */}
                {scanResult.tables.map((tbl, tableIdx) => (
                  <div key={tableIdx} className="bg-white rounded-2xl border border-sky-200 overflow-hidden shadow-lg shadow-sky-900/5">
                    {/* Table Header Banner - DME Blue Signature */}
                    <div className="bg-gradient-to-r from-sky-800 via-blue-700 to-sky-900 text-white px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-300" />
                        <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider">
                          {tbl.table_name || `Tabel ${tableIdx + 1}`}
                        </h4>
                      </div>
                      <button
                        onClick={() => handleAddRow(tableIdx)}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 border border-white/20"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Baris
                      </button>
                    </div>

                    {/* Table Grid */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-sky-100/60 border-b border-sky-200">
                            {tbl.headers.map((h, hIdx) => (
                              <th key={hIdx} className="p-3 text-[11px] font-black uppercase text-sky-950 tracking-wider">
                                {h}
                              </th>
                            ))}
                            <th className="p-3 text-[11px] font-black uppercase text-sky-950 tracking-wider text-center w-12">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {tbl.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-sky-50/40 transition">
                              {row.map((cell, colIdx) => (
                                <td key={colIdx} className="p-2">
                                  <input
                                    type="text"
                                    value={cell}
                                    onChange={(e) => handleCellChange(tableIdx, rowIdx, colIdx, e.target.value)}
                                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none transition"
                                  />
                                </td>
                              ))}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleDeleteRow(tableIdx, rowIdx)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 transition hover:bg-red-50 rounded-lg"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              💡 Tip: Anda dapat mengedit isi sel tabel hasil scan di atas sebelum mengunduh dokumen Word (DOCX).
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Tutup
              </button>
              {scanResult && (
                <button
                  onClick={handleExportDOCX}
                  disabled={isGeneratingDOCX}
                  className="px-5 py-2 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 active:scale-95"
                >
                  <FileText className="w-4 h-4" /> Export Word Document (.docx)
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Image Preview Overlay */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2">
            <img src={previewPhoto} alt="Pratinjau Foto Kertas" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-900 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
