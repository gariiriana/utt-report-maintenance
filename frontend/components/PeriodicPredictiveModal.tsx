// ============================================================================
// FILE: frontend/components/PeriodicPredictiveModal.tsx
// Deskripsi: Modal Interaktif untuk Pembuatan, Peninjauan, dan Ekspor Laporan
//            Predictive Maintenance & Reliability Forecast Periodik
//            (Bulanan & Tahunan) Data Center NeutraDC Cikarang.
// ============================================================================

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Calendar,
  Sparkles,
  Download,
  Save,
  X,
  FileText,
  Building2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PeriodicPredictiveReportData,
  PeriodicScope
} from '@/types/periodicPredictiveTypes';
import { useModalScrollLock } from '@/utils/modalScrollLock';
import { generatePeriodicPredictiveReportAI } from '@/utils/aiPeriodicPredictiveAgent';
import { exportPeriodicPredictiveReportToDocx } from '@/utils/PeriodicPredictiveWordExport';
import { exportPeriodicPredictiveReportToPdf } from '@/utils/PeriodicPredictivePdfExport';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';

interface PeriodicPredictiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCMReports: any[];
  allAbnormalFindings?: any[];
  allSparepartLogs?: any[];
  userEmail?: string;
  userName?: string;
  initialData?: PeriodicPredictiveReportData | null;
  onSaved?: (saved: PeriodicPredictiveReportData) => void;
}

function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date || (obj.constructor && obj.constructor.name !== 'Object' && !Array.isArray(obj))) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as any;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

export const PeriodicPredictiveModal: React.FC<PeriodicPredictiveModalProps> = ({
  isOpen,
  onClose,
  allCMReports,
  allAbnormalFindings = [],
  allSparepartLogs = [],
  userEmail,
  userName = 'Standby Engineer',
  initialData = null,
  onSaved
}) => {
  // Kunci scrolling halaman latar belakang saat modal ini aktif
  useModalScrollLock(isOpen);

  const [scope, setScope] = useState<PeriodicScope>(initialData?.periodType || 'monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(initialData?.month || 9);
  const [selectedYear, setSelectedYear] = useState<number>(initialData?.year || 2026);
  const [activeTab, setActiveTab] = useState<'summary' | 'systems' | 'badactors' | 'spareparts' | 'actionplan' | 'signatures'>('summary');

  const [reportData, setReportData] = useState<PeriodicPredictiveReportData | null>(initialData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filter laporan CM dan abnormal yang cocok dengan periode terpilih
  const matchingCMReports = useMemo(() => {
    return allCMReports.filter(report => {
      const dateVal = report.incidentDate || (report.reportedAt?.toDate ? report.reportedAt.toDate() : report.reportedAt);
      if (!dateVal) return true; // Include jika tidak ada tanggal spesifik
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return true;
      const repYear = d.getFullYear();
      const repMonth = d.getMonth() + 1;

      if (scope === 'yearly') {
        return repYear === selectedYear;
      }
      return repYear === selectedYear && repMonth === selectedMonth;
    });
  }, [allCMReports, scope, selectedMonth, selectedYear]);

  const matchingFindings = useMemo(() => {
    return allAbnormalFindings.filter(finding => {
      const dateVal = finding.findingDate || finding.createdAt;
      if (!dateVal) return true;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return true;
      const fYear = d.getFullYear();
      const fMonth = d.getMonth() + 1;

      if (scope === 'yearly') {
        return fYear === selectedYear;
      }
      return fYear === selectedYear && fMonth === selectedMonth;
    });
  }, [allAbnormalFindings, scope, selectedMonth, selectedYear]);

  // Handler Generate Analisis AI
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setGenerationStep('Mengagregasi data insiden & suku cadang...');
    const toastId = toast.loading('AI Reliability Agent sedang menganalisis...');

    try {
      const generated = await generatePeriodicPredictiveReportAI({
        periodType: scope,
        month: scope === 'monthly' ? selectedMonth : undefined,
        year: selectedYear,
        cmReports: matchingCMReports,
        abnormalFindings: matchingFindings,
        sparepartLogs: allSparepartLogs,
        userEmail,
        userName,
      }, (step) => {
        setGenerationStep(step);
        toast.loading(step, { id: toastId });
      });

      setReportData(generated);
      toast.success(`Analisis Prediktif ${scope === 'monthly' ? 'Bulanan' : 'Tahunan'} Berhasil Digenerate!`, { id: toastId });
    } catch (err: any) {
      console.error('Error generating periodic predictive AI:', err);
      toast.error(`Gagal membuat analisis AI: ${err?.message || 'Terjadi kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Handler Simpan ke Firestore
  const handleSaveToFirestore = async () => {
    if (!reportData) return;
    setIsSaving(true);
    const toastId = toast.loading('Menyimpan Laporan Predictive Periodik ke Firestore...');

    try {
      const docId = reportData.id || `PPR_${reportData.year}_${reportData.month || 'ANNUAL'}_${Date.now()}`;
      const docRef = doc(db, 'periodic_predictive_reports', docId);

      const rawPayload = {
        ...reportData,
        id: docId,
        updatedAt: serverTimestamp(),
        createdAt: reportData.createdAt || serverTimestamp(),
      };

      const payload = sanitizeForFirestore(rawPayload);

      await setDoc(docRef, payload, { merge: true });
      toast.success('Laporan Predictive Periodik berhasil disimpan!', { id: toastId });
      if (onSaved) onSaved(reportData);
    } catch (err: any) {
      console.error('Error saving periodic predictive report:', err);
      toast.error(`Gagal menyimpan: ${err?.message || 'Akses ditolak atau kesalahan jaringan'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler Export Word
  const handleExportWord = async () => {
    if (!reportData) return;
    setIsExportingWord(true);
    try {
      await exportPeriodicPredictiveReportToDocx(reportData);
      toast.success('Dokumen Word (.docx) Laporan Periodik berhasil diunduh!');
    } catch (err: any) {
      toast.error(`Gagal export Word: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsExportingWord(false);
    }
  };

  // Handler Export PDF
  const handleExportPdf = async () => {
    if (!reportData) return;
    setIsExportingPdf(true);
    try {
      await exportPeriodicPredictiveReportToPdf(reportData);
    } catch (err: any) {
      toast.error(`Gagal export PDF: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-purple-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold">
                  Predictive Maintenance & Reliability Forecast Periodik
                </h3>
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 border border-purple-400/40 rounded-full text-2xs font-black uppercase tracking-wider">
                  Bulanan & Tahunan AI
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Evaluasi tren degradasi, Health Score fasilitas, & proyeksi CAPEX/OPEX Data Center NeutraDC Cikarang
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Konfigurasi Periode & Trigger AI */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Scope Switcher */}
            <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setScope('monthly');
                  setReportData(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  scope === 'monthly'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Rekap Bulanan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('yearly');
                  setReportData(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  scope === 'yearly'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Rekap Tahunan</span>
              </button>
            </div>

            {/* Month Selector (if monthly) */}
            {scope === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(Number(e.target.value));
                  setReportData(null);
                }}
                className="h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setReportData(null);
              }}
              className="h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>Tahun {y}</option>
              ))}
            </select>

            {/* Indikator Data Terdeteksi */}
            <span className="text-xs text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
              Terdeteksi: <strong className="text-purple-700">{matchingCMReports.length} CM</strong> • <strong className="text-amber-700">{matchingFindings.length} Temuan</strong>
            </span>
          </div>

          {/* Tombol Generate AI */}
          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="h-9 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{generationStep || 'Menganalisis...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>{reportData ? 'Re-Generate Analisis AI' : '🧠 Jalankan Analisis AI'}</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          {!reportData ? (
            /* State Belum Ada Analisis */
            <div className="text-center py-16 px-4 max-w-xl mx-auto">
              <div className="w-16 h-16 bg-purple-100 border border-purple-300 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600 shadow-sm">
                <Brain className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Siap Melakukan Analisis Prediktif {scope === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </h4>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Pilih periode di atas dan klik tombol <strong>"Jalankan Analisis AI"</strong>. AI Agent akan mengagregasi seluruh laporan perbaikan CM, anomali peralatan, dan konsumsi sparepart di Data Center NeutraDC untuk menyusun proyeksi keandalan komprehensif.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Analisis AI Sekarang</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tampilan Hasil Analisis AI */
            <div className="space-y-5">
              <div className={`rounded-xl border p-3 text-xs ${
                reportData.analysisMetadata?.requiresEngineeringReview !== false
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}>
                <strong>Bukti & Batasan Forecast:</strong>{' '}
                Kualitas bukti <strong>{reportData.analysisMetadata?.evidenceQuality || 'Belum dinilai'}</strong>
                {' • '}keyakinan <strong>{reportData.analysisMetadata?.confidenceLevel || 'Belum dinilai'}</strong>.
                {reportData.analysisMetadata?.requiresEngineeringReview !== false && ' Review engineer wajib sebelum keputusan operasional, pengadaan, atau CAPEX.'}
                {(reportData.analysisMetadata?.sourceSummary || []).length > 0 && <span> Sumber: {reportData.analysisMetadata!.sourceSummary.join(', ')}.</span>}
                {(reportData.analysisMetadata?.dataLimitations || []).length > 0 && <span> Batasan: {reportData.analysisMetadata!.dataLimitations.join(' ')}</span>}
              </div>

              {/* Ringkasan Skor Indeks Keandalan */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm border border-purple-800/60">
                  <span className="text-2xs font-extrabold text-purple-300 uppercase tracking-wider block">
                    Facility Health Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black">{reportData.facilityHealthScore}</span>
                    <span className="text-xs text-purple-300">/ 100</span>
                  </div>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                    reportData.overallStatus === 'Optimized'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : reportData.overallStatus === 'Caution Needed'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                  }`}>
                    {reportData.overallStatus}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200">
                  <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider block">
                    Total Insiden CM
                  </span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {reportData.totalCMEvents} <span className="text-xs font-normal text-slate-500">Kejadian</span>
                  </span>
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    Berdasarkan catatan sumber periode
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200">
                  <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider block">
                    Temuan Abnormalitas
                  </span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {reportData.totalAbnormalFindings} <span className="text-xs font-normal text-slate-500">Temuan</span>
                  </span>
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    Perlu verifikasi parameter lapangan
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200">
                  <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider block">
                    Bad Actor Equipment
                  </span>
                  <span className="text-2xl font-black text-purple-900 mt-1 block">
                    {reportData.badActorAssets?.length || 0} <span className="text-xs font-normal text-slate-500">Aset Berulang</span>
                  </span>
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    Urut berdasarkan frekuensi catatan
                  </span>
                </div>
              </div>

              {/* Tab Navigation Hasil */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'summary' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  I. Ringkasan Eksekutif
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('systems')}
                  className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'systems' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  II. Evaluasi per Sub-Sistem
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('badactors')}
                  className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'badactors' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  III. Bad Actor Assets ({reportData.badActorAssets?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('spareparts')}
                  className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'spareparts' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  IV. Forecast Sparepart
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('actionplan')}
                  className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'actionplan' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  V. Rencana Tindakan & CAPEX
                </button>
              </div>

              {/* Tab Contents */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Ringkasan Narasi Eksekutif Keandalan Fasilitas
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Analisis makro tingkat keandalan data center pada {reportData.periodType === 'monthly' ? `Bulan ${reportData.monthName} ${reportData.year}` : `Tahun ${reportData.year}`}
                      </p>
                    </div>

                    <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      {reportData.executiveSummary}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nomor Laporan Resmi</span>
                        <span className="text-xs font-mono font-bold text-slate-900 mt-1 block">{reportData.reportNumber}</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Disusun Oleh</span>
                        <span className="text-xs font-bold text-slate-900 mt-1 block">{reportData.signatures?.preparedBy?.name} ({reportData.signatures?.preparedBy?.title})</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'systems' && (
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Evaluasi Keandalan per Sub-Sistem Fasilitas</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(reportData.systemAssessments || []).map((sys, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-3.5 hover:border-purple-300 transition">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h5 className="text-xs sm:text-sm font-bold text-slate-900">{sys.systemName}</h5>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                sys.riskLevel === 'Critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : sys.riskLevel === 'Warning'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}>
                                {sys.riskLevel}
                              </span>
                              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                Health: {sys.healthScore}/100
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            {sys.aiInsight}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'badactors' && (
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Peralatan Paling Rewel (Bad Actor Assets)</h4>
                      <p className="text-xs text-slate-500">Aset dengan frekuensi insiden perbaikan tertinggi yang membutuhkan perhatian khusus</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(reportData.badActorAssets || []).map((asset, idx) => (
                        <div key={idx} className="border border-amber-200 bg-amber-50/20 rounded-xl p-3.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900">{asset.equipmentName}</h5>
                              <span className="text-[11px] text-slate-500">{asset.systemCategory} • {asset.locationRoom}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-xs font-black">
                                {asset.incidentCount}x Trouble
                              </span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded text-xs font-bold">
                                RUL: {asset.estimatedRUL}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            <strong>Rekomendasi AI:</strong> {asset.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'spareparts' && (
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Proyeksi Kebutuhan Suku Cadang Kritis</h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="p-2.5">Nama Suku Cadang</th>
                            <th className="p-2.5 text-center">Prediksi Kebutuhan</th>
                            <th className="p-2.5 text-center">Status Pengadaan</th>
                            <th className="p-2.5">Justifikasi Keausan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.sparepartForecast || []).map((sp, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="p-2.5 font-bold text-slate-900">{sp.partName}</td>
                              <td className="p-2.5 text-center font-bold text-purple-700">{sp.estimatedNeeded}</td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-2xs font-black ${
                                  sp.currentStockStatus.includes('Order') || sp.currentStockStatus.includes('Critical')
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {sp.currentStockStatus}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">{sp.justification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'actionplan' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Rencana Tindakan & Rekomendasi Alokasi Anggaran</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
                        <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-1.5">
                          1. Tindakan Preventif Terjadwal (Bulan Berikutnya)
                        </h5>
                        <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                          {(reportData.actionPlan?.immediatePreventive || []).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5">
                        <h5 className="text-xs font-bold text-purple-900 uppercase tracking-wide mb-1.5">
                          2. Jadwal Overhaul Terencana (Next Quarter)
                        </h5>
                        <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                          {(reportData.actionPlan?.scheduledOverhauls || []).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
                        <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wide mb-1.5">
                          3. Rekomendasi Alokasi Peremajaan Unit / CAPEX (Next Fiscal Year)
                        </h5>
                        <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                          {(reportData.actionPlan?.capexReplacementRecommendations || []).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {reportData && (
              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={isSaving}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Simpan ke Database</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {reportData && (
              <>
                <button
                  type="button"
                  onClick={handleExportWord}
                  disabled={isExportingWord}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Unduh format Word resmi dengan kop surat dual logo"
                >
                  {isExportingWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Unduh format PDF resmi siap cetak"
                >
                  {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
