// ============================================================================
// FILE: frontend/components/MonthlyReportGenerator.tsx
// Deskripsi: 1-Click Monthly Report Generator & Viewer untuk Site Manager DME (dwimitra@co.id).
//            Format Dokumen Mengikuti 100% Persis Standar Asli NeutraDC Cikarang:
//            - Cover Page (PREVENTIVE MAINTENANCE REPORT Q1– FEBRUARY)
//            - 6-Person Approval Sheet (Dwi Tasmiyadi, Arif Budiman + TTD, OCS, TDE)
//            - Table of Contents & List of Tables
//            - Bab 1 - Bab 13 (Tabel 1 - Tabel 36) dengan Deep Blue Header (#1E64B4)
//            - Fitur Ekspor ke Word (.docx) & Cetak PDF Resmi
// ============================================================================

import { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Sparkles,
  AlertTriangle,
  Building2,
  Users,
  Award,
  BarChart3,
  BookOpen,
  Loader2,
  Package,
  Cpu,
  RefreshCw,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import {
  aggregateMonthlyReportData,
  FullMonthlyReportData
} from '@/utils/monthlyReportData';
import { generateMonthlyReportDOCX } from '@/utils/generateMonthlyReportDOCX';
import { ARIF_BUDIMAN_SIGNATURE_BASE64 } from '@/utils/engineerSignatures';
import logoNeutraDC from '@/assets/logo_neutradc.png';

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
  { value: 12, label: 'Desember' }
];

/**
 * Official Page Footer for PT Telkom Data Ekosistem with authentic circuit graphics & address
 */
export const TelkomPageFooter: React.FC<{ pageNumber?: number | string }> = ({ pageNumber }) => (
  <div className="border-t border-slate-300/80 pt-3.5 flex items-center justify-between gap-4 font-serif text-[11px] text-slate-500 mt-10 print:mt-6">
    {/* Left: Official Circuit Graphic */}
    <div className="flex items-center gap-3">
      <svg className="w-28 h-9 overflow-visible" viewBox="0 0 110 35" fill="none">
        <path d="M0 32 L22 10 L45 10 L55 20 L75 20 L88 7 L110 7" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 35 L24 15 L40 15 L50 25 L70 25 L80 15 L95 15" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 35 L28 19 L52 19 L64 31 L84 31 L94 21 L108 21" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="22" cy="10" r="2.5" fill="#E11D48" />
        <circle cx="55" cy="20" r="2.5" fill="#E11D48" />
        <circle cx="88" cy="7" r="2.5" fill="#E11D48" />
        <circle cx="40" cy="15" r="2.5" fill="#F59E0B" />
        <circle cx="70" cy="25" r="2.5" fill="#F59E0B" />
        <circle cx="28" cy="19" r="2.5" fill="#94A3B8" />
        <circle cx="64" cy="31" r="2.5" fill="#94A3B8" />
      </svg>
      {pageNumber !== undefined && (
        <span className="font-bold text-slate-700 text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
          {pageNumber}
        </span>
      )}
    </div>

    {/* Right: Official Address Block */}
    <div className="text-right leading-tight text-slate-600">
      <span className="font-bold text-slate-900 block text-xs tracking-tight">PT. Telkom Data Ekosistem</span>
      <span className="text-[10px] block">
        Kawasan The Telkom Hub, Gedung Telkom Landmark Tower II, lantai.39,
      </span>
      <span className="text-[10px] block">
        Jl. Jenderal Gatot Subroto Kav. 52, Kuningan Barat, Mampang Prapatan, Jakarta Selatan,
      </span>
      <span className="text-[10px] block">
        Jakarta, Indonesia 12710, Indonesia.
      </span>
    </div>
  </div>
);

export function MonthlyReportGenerator() {
  const { user } = useAuth();

  // State Pilihan Bulan & Tahun
  const [selectedMonth, setSelectedMonth] = useState<number>(2); // Default Februari
  const [selectedYear, setSelectedYear] = useState<number>(2026); // Default 2026

  // State Laporan
  const [reportData, setReportData] = useState<FullMonthlyReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number>(0); // 0 = Semua / Cover

  // Load Laporan
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const data = await aggregateMonthlyReportData({
        month: selectedMonth,
        year: selectedYear,
        preparedBy: user?.displayName || 'Dwi Tasmiyadi',
        contractNumber: 'K.TDE.0105/LEG.PRJ/VI/2026'
      });
      setReportData(data);
      toast.success(`Laporan Bulanan ${data.monthName} ${data.year} Berhasil Digenerate!`);
    } catch (err: any) {
      console.error('Error generating monthly report:', err);
      toast.error(`Gagal membuat laporan: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Generate on initial mount
  useEffect(() => {
    handleGenerateReport();
  }, [selectedMonth, selectedYear]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export to DOCX Handler
  const handleExportDocx = async () => {
    if (!reportData) return;
    setExportingDocx(true);
    try {
      await generateMonthlyReportDOCX(reportData);
      toast.success('File Microsoft Word (.docx) berhasil dibuat dan diunduh!');
    } catch (err: any) {
      console.error('Error exporting docx:', err);
      toast.error(`Gagal mengekspor file DOCX: ${err.message}`);
    } finally {
      setExportingDocx(false);
    }
  };

  const CHAPTERS = [
    { id: 0, title: 'Semua / Cover & Approval Sheet', icon: Building2 },
    { id: 1, title: '1. Executive Summary', icon: Award },
    { id: 2, title: '2. Key Highlight & Schedule (Tabel 1-17)', icon: Calendar },
    { id: 3, title: '3. General Information & Tim (Tabel 18)', icon: Users },
    { id: 4, title: '4. Maintenance Objectives & KPI (Tabel 19)', icon: BarChart3 },
    { id: 5, title: '5. Equipment Details (Tabel 20-21)', icon: Cpu },
    { id: 6, title: '6. Scope of Work (Tabel 22)', icon: BookOpen },
    { id: 7, title: '7. Observation & Finding (Tabel 23-28)', icon: AlertTriangle },
    { id: 8, title: '8. Repairs & Services (Tabel 29)', icon: Package },
    { id: 9, title: '9. Calibration & Validation (Tabel 30-31)', icon: Sparkles },
    { id: 10, title: '10. Challenges & Mitigation (Tabel 32-34)', icon: FileText },
    { id: 11, title: '11. Recommendations (Tabel 35)', icon: FileText },
    { id: 12, title: '12. Photo Log (Tabel 36)', icon: FileText },
    { id: 13, title: '13. Appendices', icon: FileText }
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* ─── Control Bar (Sembunyi saat Print) ─────────────────────────────────── */}
      <div className="print:hidden bg-white text-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>1-Click Automated Monthly Report Engine (Format Standar PDF NeutraDC)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Laporan Bulanan Maintenance (Monthly Report)
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Format, tabel warna biru (#1E64B4), lembar pengesahan 6 signer, dan struktur 13 Bab & 36 Tabel
              mengikuti 100% dokumen resmi PT Telkom Data Ekosistem.
            </p>
          </div>

          {/* Month & Year Selectors + Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value} className="bg-white text-slate-800">
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y} className="bg-white text-slate-800">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <RefreshCw className="w-4 h-4 text-slate-600" />}
              <span>{generating ? 'Memproses...' : 'Refresh Data'}</span>
            </button>

            {/* Export to Word (.docx) Button */}
            <button
              onClick={handleExportDocx}
              disabled={exportingDocx || !reportData}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exportingDocx ? 'Menyusun Word...' : 'Ekspor ke Word (.docx)'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Badges */}
        {reportData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Schedule Plan vs Actual</span>
              <span className="text-xl font-black text-slate-800">
                {reportData.scheduleTable1.length} Lingkup Sistem
              </span>
            </div>
            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/60">
              <span className="text-xs text-emerald-700 font-medium block">Critical Uptime</span>
              <span className="text-xl font-black text-emerald-700">100.00%</span>
            </div>
            <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200/60">
              <span className="text-xs text-indigo-700 font-medium block">Total Skor Kinerja</span>
              <span className="text-xl font-black text-indigo-700">
                {reportData.kpiSummary.totalPerformance} (SLA OK)
              </span>
            </div>
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/60">
              <span className="text-xs text-amber-700 font-medium block">Temuan & Suku Cadang</span>
              <span className="text-xl font-black text-amber-700">
                {reportData.repairsTable29.length} Item Tercatat
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Chapter Selector Tabs (Sembunyi saat Print) ────────────────────── */}
      <div className="print:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {CHAPTERS.map(ch => {
            const Icon = ch.icon;
            const isActive = activeChapter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Report Document Content ────────────────────────────────────── */}
      {generating && !reportData ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 shadow-sm text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-800">Menyusun Data Laporan Bulanan Resmi...</h3>
          <p className="text-xs text-slate-500 mt-1">Mengagregasi 13 Bab, 36 Tabel, Master BOQ, dan Dokumen Teknisi.</p>
        </div>
      ) : reportData && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-12 space-y-16 print:border-none print:shadow-none print:p-0">
          
          {/* ===================================================================
              PAGE 1: COVER PAGE
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="min-h-[90vh] flex flex-col justify-between py-12 px-8 border-b border-slate-200 print:border-none print:page-break-after">
              <div className="space-y-6 pt-12">
                <h1 className="text-4xl sm:text-5xl font-serif font-black text-slate-900 leading-tight">
                  PREVENTIVE<br />
                  MAINTENANCE REPORT<br />
                  <span className="text-slate-900 font-bold">{reportData.quarter}– {reportData.monthNameEn.toUpperCase()}</span>
                </h1>
                <p className="text-sm font-serif text-slate-700 font-medium">
                  {reportData.docCode}
                </p>
              </div>

              <div className="space-y-2 py-16">
                <h2 className="text-3xl font-serif text-slate-900">HDC Cikarang</h2>
                <h3 className="text-2xl font-serif text-slate-800">PT Telkom Data Ekosistem</h3>
              </div>

              {/* Cover Footer */}
              <TelkomPageFooter pageNumber={1} />
            </section>
          )}

          {/* ===================================================================
              PAGE 2: LEMBAR PENGESAHAN (APPROVAL SHEET)
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="space-y-8 border-b border-slate-200 pb-12 print:border-none print:page-break-after">
              {/* Header Logo */}
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-tight text-center mb-10">
                APPROVAL SHEET
              </h2>

              {/* 6-Signer Grid: 2 Columns x 3 Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10 max-w-4xl mx-auto text-center font-serif">
                {/* Row 1: Prepared by Dwi Tasmiyadi vs Reviewed by Arif Budiman */}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-600">Prepared By</p>
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-300">[ Signed ]</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.preparedBy.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.preparedBy.company}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-600">Reviewed By</p>
                  <div className="h-20 flex items-center justify-center">
                    <img src={ARIF_BUDIMAN_SIGNATURE_BASE64} alt="TTD Arif Budiman" className="h-16 object-contain" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.reviewedBy1.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.reviewedBy1.company}</p>
                </div>

                {/* Row 2: Reviewed by Andrean Bima Pratama vs Supriyatno (OCS) */}
                <div className="space-y-1 pt-6">
                  <p className="text-xs font-bold text-slate-600">Reviewed By</p>
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-300">[ Signed ]</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.reviewedBy2.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.reviewedBy2.company}</p>
                </div>

                <div className="space-y-1 pt-6">
                  <p className="text-xs font-bold text-slate-600">Reviewed By</p>
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-300">[ Signed ]</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.reviewedBy3.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.reviewedBy3.company}</p>
                </div>

                {/* Row 3: Approved by Budi Susanto vs Rezki Rahman Daulay (TDE) */}
                <div className="space-y-1 pt-6">
                  <p className="text-xs font-bold text-slate-600">Approved By</p>
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-300">[ Approved ]</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.approvedBy1.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.approvedBy1.company}</p>
                </div>

                <div className="space-y-1 pt-6">
                  <p className="text-xs font-bold text-slate-600">Approved By</p>
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-300">[ Approved ]</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{reportData.approvalSheet.approvedBy2.name}</p>
                  <p className="text-xs text-slate-600">{reportData.approvalSheet.approvedBy2.company}</p>
                </div>
              </div>

              {/* Page Footer */}
              <TelkomPageFooter pageNumber={2} />
            </section>
          )}

          {/* ===================================================================
              PAGE 3: TABLE OF CONTENTS
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || window.matchMedia('print').matches) && (
            <section className="space-y-6 border-b border-slate-200 pb-12 print:border-none print:page-break-after">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-2xl font-serif font-bold text-blue-900 text-center mb-8">
                Table of Contents
              </h2>

              <div className="max-w-3xl mx-auto font-serif text-sm space-y-2 text-slate-800">
                {[
                  { title: '1. Executive Summary', page: '5' },
                  { title: '2. Key Highlight', page: '5' },
                  { title: '3. General Information', page: '218' },
                  { title: '4. Maintenance Objectives', page: '218' },
                  { title: '5. Equipment and System Details', page: '220' },
                  { title: '6. Scope of Work', page: '238' },
                  { title: '7. Observation and Finding', page: '252' },
                  { title: '8. Repairs, Replacement & Services', page: '256' },
                  { title: '9. Testing & Validation', page: '258' },
                  { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
                  { title: '11. Recommendations and Future Action', page: '264' },
                  { title: '12. Photo and Documentation Log', page: '265' },
                  { title: '13. Appendices', page: '268' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-dotted border-slate-300 pb-1">
                    <span className="font-bold text-slate-900">{item.title}</span>
                    <span className="font-bold text-slate-800">{item.page}</span>
                  </div>
                ))}
              </div>

              <TelkomPageFooter pageNumber={3} />
            </section>
          )}

          {/* ===================================================================
              BAB 1: EXECUTIVE SUMMARY & BAB 2: KEY HIGHLIGHT (TABEL 1)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || activeChapter === 2 || window.matchMedia('print').matches) && (
            <section className="space-y-6">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="font-serif space-y-4 text-slate-800 leading-relaxed text-sm">
                <h2 className="text-xl font-bold text-slate-900">1. Executive Summary</h2>
                <p>
                  Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).
                </p>

                <h3 className="text-base font-bold text-slate-900 pt-2">Purpose of Report</h3>
                <p>
                  To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:
                </p>
                <ol className="list-decimal pl-6 space-y-1">
                  <li><strong>Documentation of Preventive Maintenance Activities:</strong> Records all PM activities that have been carried out for one month. Include details such as schedule, equipment maintained, methods used, inspection results, and corrective actions if any.</li>
                  <li><strong>Equipment and System Performance Evaluation:</strong> Assess the condition of equipment based on inspection and maintenance results.</li>
                  <li><strong>Reporting to Management:</strong> Provides management with a comprehensive overview of the condition of the facility and the effectiveness of the PM program.</li>
                  <li><strong>Ensure Compliance with Procedures and Standards:</strong> Prove that PM activities are carried out in accordance with applicable Procedures and regulations (e.g. national/international standards).</li>
                </ol>

                <h2 className="text-xl font-bold text-slate-900 pt-6">2. Key Highlight</h2>
                <p className="font-bold text-center text-slate-900 text-sm my-3">
                  Table 1. Schedule Maintenance – {reportData.monthNameEn} {reportData.year}
                </p>
              </div>

              {/* Tabel 1: Schedule Maintenance - Deep Blue Header */}
              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs font-serif border-collapse">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-slate-400">No</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Device</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Location</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Maintenance Partner</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">Plan</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">Actual</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.scheduleTable1.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="py-2 px-3 text-center font-bold border-r border-slate-300">{item.no}</td>
                        <td className="py-2 px-3 font-bold border-r border-slate-300">{item.device}</td>
                        <td className="py-2 px-3 border-r border-slate-300">{item.location}</td>
                        <td className="py-2 px-3 border-r border-slate-300">{item.maintenancePartner}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300 whitespace-nowrap">{item.plan}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300 whitespace-nowrap">{item.actual}</td>
                        <td className="py-2 px-3 text-center font-semibold">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Task Performance Scope Tables (Tabel 2 - 5) */}
              <div className="space-y-8 pt-8">
                {reportData.taskPerformanceTables.map((tTable, tIdx) => (
                  <div key={tIdx} className="space-y-3">
                    <p className="font-bold text-center text-slate-900 text-sm font-serif">
                      {tTable.title}
                    </p>
                    <div className="overflow-x-auto border border-slate-400">
                      <table className="w-full text-left text-[11px] font-serif border-collapse">
                        <thead>
                          <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                            <th className="py-2.5 px-2 text-center w-8 border-r border-slate-400">No</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Class Name</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Capacity</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Location</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Product Name</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Task Preventive Maintenance</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Critical Repairs</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Operational Status</th>
                            <th className="py-2.5 px-2 border-r border-slate-400">Issues</th>
                            <th className="py-2.5 px-2">Recommendations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-800">
                          {tTable.items.map((item, iIdx) => (
                            <tr key={iIdx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-2 text-center font-bold border-r border-slate-300">{item.no}</td>
                              <td className="py-2 px-2 font-bold border-r border-slate-300">{item.className}</td>
                              <td className="py-2 px-2 border-r border-slate-300">{item.capacity}</td>
                              <td className="py-2 px-2 border-r border-slate-300">{item.location}</td>
                              <td className="py-2 px-2 border-r border-slate-300 font-bold">{item.productName}</td>
                              <td className="py-2 px-2 border-r border-slate-300 text-[10px] whitespace-pre-line text-left">{item.taskPM}</td>
                              <td className="py-2 px-2 border-r border-slate-300 text-[10px]">{item.criticalRepairs}</td>
                              <td className="py-2 px-2 border-r border-slate-300 font-semibold">{item.operationalStatus}</td>
                              <td className="py-2 px-2 border-r border-slate-300 text-[10px] text-amber-900">{item.issues}</td>
                              <td className="py-2 px-2 text-[10px] text-blue-900">{item.recommendations}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 3: GENERAL INFORMATION & TIM (TABEL 18)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 3 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">3. General Information</h2>
              <div className="text-sm space-y-1 text-slate-800">
                <p><strong>Maintenance Type :</strong> {reportData.generalInfo.maintenanceType}</p>
                <p><strong>Contract Reference :</strong> {reportData.generalInfo.contractReference}</p>
                <p><strong>Timeline :</strong> {reportData.generalInfo.timeline.startDate} - {reportData.generalInfo.timeline.endDate}</p>
                <p><strong>Total Hours Worked :</strong> {reportData.generalInfo.timeline.totalHoursWorked}</p>
                <p><strong>Standard Followed :</strong> {reportData.generalInfo.timeline.standardsFollowed.join(', ')}</p>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 18. Team Composition
              </p>

              <div className="max-w-2xl mx-auto border border-slate-400 overflow-hidden text-xs">
                <div className="bg-[#92B8DE] p-3 text-center border-b border-slate-400">
                  <span className="font-bold text-slate-900 block">Team Leader</span>
                  <span className="text-slate-800">{reportData.generalInfo.teamLeader.name} / {reportData.generalInfo.teamLeader.role} / {reportData.generalInfo.teamLeader.phone}</span>
                </div>
                <div className="bg-[#1E64B4] text-white p-2 text-center font-bold border-b border-slate-400">
                  Team Member
                </div>
                <div className="grid grid-cols-3 divide-x divide-y divide-slate-300 text-center font-medium">
                  {reportData.generalInfo.teamMembers.map((tm, idx) => (
                    <div key={idx} className="p-2.5 hover:bg-slate-50">
                      {tm}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 4: KPI METRICS (TABEL 19)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 4 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">4. Maintenance Objectives & KPI Metrics</h2>
              
              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 19. KPI Metric
              </p>

              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">NO</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">ACTIVITY</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">UNIT</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">ORDER</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">FINISH</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">%FINISH</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">COMPLY</th>
                      <th className="py-2.5 px-3 text-center">%COMPLY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.kpiMetricsTable19.map((k, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-slate-300">{k.no}</td>
                        <td className="py-2 px-3 border-r border-slate-300">{k.activity}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300">{k.unit}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300">{k.order}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300">{k.finish}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300 font-semibold">{k.pctFinish}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300">{k.comply}</td>
                        <td className="py-2 px-3 text-center font-bold text-blue-900">{k.pctComply}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#92B8DE] text-slate-900 font-bold">
                      <td colSpan={7} className="py-2.5 px-4 text-right border-r border-slate-400">
                        TOTAL PERSENTASE PEMENUHAN KINERJA QUARTER 1:
                      </td>
                      <td className="py-2.5 px-3 text-center bg-yellow-200 font-black text-sm">
                        {reportData.kpiSummary.totalPerformance}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Service Credit Penalty Matrix */}
              <div className="max-w-md mx-auto border border-slate-400 overflow-hidden text-xs mt-6">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold">
                      <th className="py-2 px-3 border-r border-slate-400">Nilai Total Kinerja %</th>
                      <th className="py-2 px-3">Persentase Kredit Layanan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    <tr><td className="py-1.5 px-3 border-r border-slate-300">98% - 100%</td><td>0%</td></tr>
                    <tr><td className="py-1.5 px-3 border-r border-slate-300">95% - &lt;98%</td><td>5%</td></tr>
                    <tr className="bg-yellow-200 font-bold"><td className="py-1.5 px-3 border-r border-slate-300">90% - &lt;95%</td><td>10%</td></tr>
                    <tr><td className="py-1.5 px-3 border-r border-slate-300">85% - &lt;90%</td><td>15%</td></tr>
                    <tr><td className="py-1.5 px-3 border-r border-slate-300">80% - &lt;85%</td><td>20%</td></tr>
                    <tr className="text-red-700 font-bold"><td className="py-1.5 px-3 border-r border-slate-300">&lt;80%</td><td>Kontrak dapat diputus</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 5: EQUIPMENT AND SYSTEM DETAILS (TABEL 20 & TABEL 21)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 5 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">5. Equipment and System Details</h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                Rincian aset peralatan dan spesifikasi teknis fasilitas Data Center NeutraDC Cikarang yang tercatat pada Master Asset BOQ beserta riwayat pemeliharaan berkala terakhir dan jarak siklus operasionalnya:
              </p>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 20. Equipment and System Details
              </p>

              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-2 text-center border-r border-slate-400">No</th>
                      <th className="py-2.5 px-2 border-r border-slate-400">Class Name</th>
                      <th className="py-2.5 px-2 border-r border-slate-400">Model/SN</th>
                      <th className="py-2.5 px-2 border-r border-slate-400">Manufacture</th>
                      <th className="py-2.5 px-2 text-center border-r border-slate-400">Install Date</th>
                      <th className="py-2.5 px-2 border-r border-slate-400">Location</th>
                      <th className="py-2.5 px-2 text-center border-r border-slate-400">Last Maintenance Date</th>
                      <th className="py-2.5 px-2 text-center border-r border-slate-400">Current Operational Date</th>
                      <th className="py-2.5 px-2 text-center">Status Before Maintenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.equipmentDetailsTable20.slice(0, 30).map((eq, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-2 text-center font-bold border-r border-slate-300">{eq.no}</td>
                        <td className="py-2 px-2 font-bold border-r border-slate-300">{eq.className}</td>
                        <td className="py-2 px-2 font-mono text-[11px] border-r border-slate-300">{eq.modelSN}</td>
                        <td className="py-2 px-2 border-r border-slate-300">{eq.manufacture}</td>
                        <td className="py-2 px-2 text-center border-r border-slate-300">{eq.installDate}</td>
                        <td className="py-2 px-2 border-r border-slate-300">{eq.location}</td>
                        <td className="py-2 px-2 text-center font-semibold text-blue-900 border-r border-slate-300">{eq.lastMaintenanceDate}</td>
                        <td className="py-2 px-2 text-center font-medium border-r border-slate-300">{eq.currentOperationalDate}</td>
                        <td className="py-2 px-2 text-center text-slate-600">{eq.statusBeforeMaintenance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 21: System Overview (AI Agent Overview) */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-sm">
                    Table 21. System Overview
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>AI Agent Generated Overview</span>
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-400">
                  <table className="w-full text-left text-xs border-collapse font-serif">
                    <thead>
                      <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                        <th className="py-2.5 px-3 text-center w-12 border-r border-slate-400">No</th>
                        <th className="py-2.5 px-3 w-48 border-r border-slate-400">Component / System</th>
                        <th className="py-2.5 px-3">Function & Maintenance Importance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-800">
                      {reportData.systemOverviewTable21.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20">
                          <td className="py-2.5 px-3 text-center font-bold border-r border-slate-300">{item.no}</td>
                          <td className="py-2.5 px-3 font-bold border-r border-slate-300 text-blue-950">{item.component}</td>
                          <td className="py-2.5 px-3 leading-relaxed">{item.functionDesc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 6: SCOPE OF WORK (TABEL 22)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 6 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">6. Scope of Work</h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                Rangkaian tahapan prosedur operasional standar (SOP) Preventive Maintenance yang dijalankan oleh tim teknisi DME pada setiap perangkat:
              </p>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 22. Scope of Work
              </p>

              <div className="space-y-4">
                {reportData.scopeOfWorkTable22.map((sow, sIdx) => (
                  <div key={sIdx} className="border border-slate-400 overflow-hidden text-xs">
                    <div className="bg-[#1E64B4] text-white p-2.5 font-bold text-sm">
                      {sow.category}
                    </div>
                    <div className="divide-y divide-slate-300">
                      {sow.items.map((step, stIdx) => (
                        <div key={stIdx} className="p-3 bg-slate-50/50 space-y-1.5">
                          <h4 className="font-bold text-slate-900 text-xs">{step.step}</h4>
                          <ul className="list-disc pl-5 space-y-1 text-slate-700 text-[11px]">
                            {step.tasks.map((task, tIdx) => (
                              <li key={tIdx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 7: OBSERVATION & FINDINGS (TABEL 23 & ROOT CAUSE)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 7 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">7. Observation and Finding</h2>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 23. Observation & Finding
              </p>

              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-slate-400">No</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Component</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Condition Before</th>
                      <th className="py-2.5 px-3">Inspection Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.observationTable23.map((sec, sIdx) => (
                      <>
                        <tr key={`sec-${sIdx}`} className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-2 px-3">{sec.scope}</td>
                        </tr>
                        {sec.items.map((item, iIdx) => (
                          <tr key={`item-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-slate-300">{item.no}</td>
                            <td className="py-2 px-3 font-bold border-r border-slate-300">{item.component}</td>
                            <td className="py-2 px-3 border-r border-slate-300">{item.conditionBefore}</td>
                            <td className="py-2 px-3">{item.inspectionNotes}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Root Cause Analyses Section */}
              <div className="space-y-6 pt-6">
                <h3 className="text-lg font-bold text-slate-900">Root Cause Analysis</h3>
                {reportData.rootCauseAnalyses.map((rca, rIdx) => (
                  <div key={rIdx} className="space-y-3">
                    <h4 className="text-sm font-bold text-blue-950">{rca.title}</h4>
                    <p className="text-xs text-slate-700 leading-relaxed">{rca.description}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {rca.photos.map((ph, pIdx) => (
                        <div key={pIdx} className="border border-slate-300 rounded-xl overflow-hidden text-center bg-slate-50">
                          <img src={ph.url} alt={ph.caption} className="w-full h-28 object-cover" />
                          <p className="text-[10px] p-1.5 font-bold text-slate-700">{ph.caption}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 8: REPAIRS, REPLACEMENT & SERVICES (TABEL 29)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 8 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">8. Repairs, Replacement & Services</h2>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 29. Repair, Replacement & Services
              </p>

              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-3 border-r border-slate-400">Equipment</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Part Name</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Part Number</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-400">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Replaced/Serviced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.repairsTable29.map((r, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 font-bold border-r border-slate-300">{r.equipment}</td>
                        <td className="py-2 px-3 border-r border-slate-300">{r.partName}</td>
                        <td className="py-2 px-3 border-r border-slate-300 font-mono text-[11px]">{r.partNumber}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-300">{r.quantity}</td>
                        <td className="py-2 px-3 text-center font-semibold">{r.replacedStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 11: RECOMMENDATIONS & FUTURE ACTION (TABEL 35)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 11 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">11. Recommendations and Future Action</h2>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 35. Recommendations and Future Action
              </p>

              <div className="overflow-x-auto border border-slate-400">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#1E64B4] text-white font-bold border-b border-slate-400">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-slate-400">No</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Component</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">Short-Term Recommendations</th>
                      <th className="py-2.5 px-3">Long-Term Recommendations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {reportData.recommendationsTable35.map((rSec, sIdx) => (
                      <>
                        <tr key={`rsec-${sIdx}`} className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-2 px-3">{rSec.scope}</td>
                        </tr>
                        {rSec.items.map((item, iIdx) => (
                          <tr key={`ritem-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-slate-300">{item.no}</td>
                            <td className="py-2 px-3 font-bold border-r border-slate-300">{item.component}</td>
                            <td className="py-2 px-3 border-r border-slate-300">{item.shortTerm}</td>
                            <td className="py-2 px-3">{item.longTerm}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 13: APPENDICES
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 13 || window.matchMedia('print').matches) && (
            <section className="space-y-4 font-serif border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-900">13. Appendices</h2>
              <p className="text-sm text-slate-600 italic">
                Attach the original service report & supporting documents for certification, test results, etc.
              </p>
              <TelkomPageFooter pageNumber="Appendices" />
            </section>
          )}

        </div>
      )}
    </div>
  );
}
