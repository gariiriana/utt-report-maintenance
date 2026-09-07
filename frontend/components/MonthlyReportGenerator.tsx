// ============================================================================
// FILE: frontend/components/MonthlyReportGenerator.tsx
// Deskripsi: 1-Click Monthly Report Generator & Interactive Web Editor.
//            Format Dokumen Mengikuti 100% Persis Standar Asli NeutraDC Cikarang:
//            - Cover Page (PREVENTIVE MAINTENANCE REPORT Q1– FEBRUARY / Q3– JULY)
//            - 6-Person Approval Sheet (Arif Budiman + TTD, Dwi Tasmiyadi, OCS, TDE)
//            - Table of Contents & List of Tables
//            - Bab 1 - Bab 13 (Tabel 1 - Tabel 36) dengan Deep Blue Header (#0066B3)
//            - Seluruh sel tabel & narasi inline-editable secara interaktif di web
//            - Fitur Ekspor ke Word (.docx) 100% Presisi & Cetak PDF Resmi
// ============================================================================

import React, { useState, useEffect } from 'react';
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
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  X,
  Upload,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { draftStorage } from '@/utils/draftStorage';

import {
  aggregateMonthlyReportData,
  FullMonthlyReportData,
  convertReportToBilingual,
  getScopeOfWorkForScope,
  MASTER_PM_SCHEDULES,
  getDefaultBoqUnitForDevice
} from '@/utils/monthlyReportData';
import { generateMonthlyReportDOCX } from '@/utils/generateMonthlyReportDOCX';
import {
  generateRecommendationsFromFindings,
  generateTestingAndValidation,
  generateChallengesAndMitigations,
  convertReportToBilingualWithAI
} from '@/utils/monthlyReportAI';
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
  <div className="border-t border-black/80 pt-3.5 flex items-center justify-between gap-4 font-serif text-[11px] text-slate-500 mt-10 print:mt-6">
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

/**
 * Helper component for bilingual fields.
 * Displays English line on top (normal font) and Indonesian translation below (italic font / garis miring).
 */
export const BilingualTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholderEn?: string;
  placeholderId?: string;
  classNameEn?: string;
  classNameId?: string;
  containerClassName?: string;
  indentId?: boolean;
}> = ({
  value,
  onChange,
  placeholderEn = "English text...",
  placeholderId = "Bahasa Indonesia (garis miring)...",
  classNameEn = "w-full text-xs text-slate-900 leading-snug py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans",
  classNameId = "w-full text-[11px] italic text-slate-600 leading-snug py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans",
  containerClassName = "w-full flex flex-col space-y-0.5",
  indentId = true,
}) => {
  const parts = (value || '').split('\n');
  const enVal = parts[0] || '';
  const idVal = parts.slice(1).join('\n');

  return (
    <div className={containerClassName}>
      <textarea
        rows={Math.max(1, Math.ceil((enVal || '').length / 65))}
        value={enVal}
        placeholder={placeholderEn}
        onChange={(e) => {
          const newEn = e.target.value;
          if (newEn.includes('\n') && !idVal) {
            onChange(newEn);
          } else {
            onChange(idVal ? `${newEn}\n${idVal}` : newEn);
          }
        }}
        className={classNameEn}
      />
      {(idVal !== undefined) && (
        <div className={indentId ? "pl-2.5 border-l-2 border-blue-200/70" : ""}>
          <textarea
            rows={Math.max(1, Math.ceil((idVal || '').length / 65))}
            value={idVal}
            placeholder={placeholderId}
            onChange={(e) => {
              const newId = e.target.value;
              onChange(`${enVal}\n${newId}`);
            }}
            className={classNameId}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Helper component for multi-bullet bilingual task lists (like taskPM).
 * Pairs each bullet point with its English description and italicized Indonesian translation below.
 */
export const BilingualBulletsEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
}> = ({ value, onChange }) => {
  const lines = (value || '').split('\n');
  const hasBullets = lines.some(l => /^[•\-\*]/.test(l.trim()));

  if (!hasBullets) {
    return (
      <BilingualTextarea
        value={value}
        onChange={onChange}
        classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-slate-800"
        classNameId="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
      />
    );
  }

  const bullets: { en: string; id: string }[] = [];
  let cur: { en: string; id: string } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[•\-\*]/.test(trimmed)) {
      if (cur) bullets.push(cur);
      cur = { en: trimmed.replace(/^[•\-\*]\s*/, ''), id: '' };
    } else if (cur) {
      cur.id = cur.id ? `${cur.id} ${trimmed}` : trimmed;
    } else {
      cur = { en: trimmed, id: '' };
    }
  }
  if (cur) bullets.push(cur);

  const updateBullet = (idx: number, field: 'en' | 'id', text: string) => {
    const updated = [...bullets];
    updated[idx][field] = text;
    const newStr = updated.map(b => b.id ? `• ${b.en}\n  ${b.id}` : `• ${b.en}`).join('\n');
    onChange(newStr);
  };

  return (
    <div className="w-full flex flex-col space-y-1.5">
      {bullets.map((b, bIdx) => (
        <div key={bIdx} className="space-y-0.5">
          <div className="flex items-start gap-1">
            <span className="text-slate-400 font-bold select-none text-[10px] leading-none mt-1">•</span>
            <textarea
              rows={Math.max(1, Math.ceil(b.en.length / 32))}
              value={b.en}
              onChange={(e) => updateBullet(bIdx, 'en', e.target.value)}
              className="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans text-slate-800"
            />
          </div>
          <div className="pl-3 border-l border-slate-200">
            <textarea
              rows={Math.max(1, Math.ceil((b.id || '').length / 32))}
              value={b.id}
              placeholder="Terjemahan bahasa Indonesia (garis miring)..."
              onChange={(e) => updateBullet(bIdx, 'id', e.target.value)}
              className="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export function MonthlyReportGenerator() {
  // State Pilihan Bulan & Tahun (Default: Juli 2026 sesuai file acuan)
  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // State Laporan & Status
  const [reportData, setReportData] = useState<FullMonthlyReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number>(0); // 0 = Semua / Cover
  const [isSavedLocally, setIsSavedLocally] = useState(false);


  // Handler Perubahan Periode Bulan & Tahun (Langsung bersihkan stale reportData agar tidak stuck)
  const handleMonthChange = (newMonth: number) => {
    if (newMonth === selectedMonth) return;
    setReportData(null);
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (newYear: number) => {
    if (newYear === selectedYear) return;
    setReportData(null);
    setSelectedYear(newYear);
  };

  // Bersihkan legacy localStorage yang menghabiskan kuota 5MB browser
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('dwimitra_monthly_report_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }, []);

  // Load Laporan dari Database / Cache (IndexedDB via draftStorage)
  const handleGenerateReport = async (
    forceFresh = false,
    targetMonth = selectedMonth,
    targetYear = selectedYear
  ) => {
    setGenerating(true);
    const storageKey = `dwimitra_monthly_report_${targetYear}_${targetMonth}`;

    // Cek cache draft (IndexedDB) kecuali jika di-force fresh
    if (!forceFresh) {
      try {
        let parsed = await draftStorage.get(storageKey);
        if (!parsed) {
          const legacy = localStorage.getItem(storageKey);
          if (legacy) {
            try {
              parsed = JSON.parse(legacy);
            } catch (_) {}
          }
        }

        if (parsed) {
          // CRITICAL VALIDATION: Pastikan cache yang dibaca benar-benar milik targetMonth & targetYear!
          if (!parsed || parsed.monthNumber !== targetMonth || parsed.year !== targetYear) {
            console.warn(`[MonthlyReport] Cache mismatch / corrupted: target ${targetMonth}/${targetYear}, found ${parsed?.monthNumber}/${parsed?.year}. Membersihkan cache...`);
            await draftStorage.remove(storageKey);
            try { localStorage.removeItem(storageKey); } catch (_) {}
          } else {
            // 1. Normalisasi LPS -> Lightning Protection System pada scheduleTable1 & purge unmapped
            if (Array.isArray(parsed.scheduleTable1)) {
              parsed.scheduleTable1 = parsed.scheduleTable1.filter((s: any) => 
                !s.plan?.toLowerCase().includes('ad-hoc') && !s.plan?.toLowerCase().includes('corrective')
              );
              parsed.scheduleTable1.forEach((s: any) => {
                if (s.device?.toUpperCase() === 'LPS' || s.device?.toLowerCase() === 'lightning protection') {
                  s.device = 'Lightning Protection System';
                }
              });
              // Hapus duplikasi jika ada 2 item device yang sama di scheduleTable1
              const seenDevices = new Set<string>();
              parsed.scheduleTable1 = parsed.scheduleTable1.filter((s: any) => {
                if (seenDevices.has(s.device)) return false;
                seenDevices.add(s.device);
                return true;
              });
              parsed.scheduleTable1.forEach((s: any, idx: number) => { s.no = idx + 1; });
            }

            // 2. Normalisasi LPS -> Lightning Protection System pada taskPerformanceTables
            if (Array.isArray(parsed.taskPerformanceTables)) {
              parsed.taskPerformanceTables.forEach((t: any) => {
                if (t.scope?.toUpperCase() === 'LPS' || t.scope?.toLowerCase() === 'lightning protection') {
                  t.scope = 'Lightning Protection System';
                  t.title = `Table ${t.tableNo}. Total Task Performance Lightning Protection System`;
                }
              });
              // Hapus duplikasi tabel jika ada 2 tabel Lightning Protection System
              const seenScopes = new Set<string>();
              parsed.taskPerformanceTables = parsed.taskPerformanceTables.filter((t: any) => {
                if (seenScopes.has(t.scope)) return false;
                seenScopes.add(t.scope);
                return true;
              });
              // Filter hanya tabel yang equipment-nya memang ada di scheduleTable1
              const validSchedScopes = new Set((parsed.scheduleTable1 || []).map((s: any) => s.device));
              if (validSchedScopes.size > 0) {
                parsed.taskPerformanceTables = parsed.taskPerformanceTables.filter((t: any) => validSchedScopes.has(t.scope));
              }
              // Re-index nomor tabel (Tabel 2, 3, ...)
              let tableNum = 2;
              parsed.taskPerformanceTables.forEach((t: any) => {
                t.tableNo = tableNum;
                t.title = `Table ${tableNum}. Total Task Performance ${t.scope}`;
                tableNum++;
              });
            }

            // 3. Sinkronisasi Dinamis Bab 6 Scope of Work (Tabel 22):
            // Jika data cache masih format lama/dummy atau belum versi detail SR terbaru, perbarui otomatis!
            const schedScopes: string[] = (parsed.scheduleTable1 || []).map((s: any) => s.device);
            if (
              !Array.isArray(parsed.scopeOfWorkTable22) ||
              parsed.scopeOfWorkTable22.length !== schedScopes.length ||
              parsed._sowDetailedVersion !== 3 ||
              parsed.scopeOfWorkTable22.some((c: any) => 
                c.items?.some((it: any) => it.tasks?.some((t: string) => !t.includes('\n'))) ||
                c.category?.includes('BARU') || 
                c.category?.includes('DUMMY') || 
                c.category === 'CHILLER & HVAC SYSTEM' ||
                c.category === 'CHILLER & PRIMARY COOLING SYSTEM' && schedScopes.length > 1 && parsed.scopeOfWorkTable22.length === 1
              )
            ) {
              parsed.scopeOfWorkTable22 = schedScopes.map((scope: string) => getScopeOfWorkForScope(scope));
              parsed._sowDetailedVersion = 3;
            }

            // 4. Normalisasi signer reviewedBy2 OCS -> Habib Mulyana
            if (parsed.approvalSheet?.reviewedBy2?.name === 'Andrean Bima Pratama') {
              parsed.approvalSheet.reviewedBy2.name = 'Habib Mulyana';
            }

            // 5. Normalisasi signer Row 1: Prepared by Arif Budiman & Reviewed by Dwi Tasmiyadi
            if (parsed.approvalSheet) {
              if (parsed.approvalSheet.preparedBy?.name === 'Dwi Tasmiyadi' && parsed.approvalSheet.reviewedBy1?.name === 'Arif Budiman') {
                parsed.approvalSheet.preparedBy.name = 'Arif Budiman';
                parsed.approvalSheet.reviewedBy1.name = 'Dwi Tasmiyadi';
              }
            }

            setReportData(parsed);
            setIsSavedLocally(true);
            setGenerating(false);
            // Simpan kembali cache yang sudah dibersihkan dan disinkronkan ke IndexedDB
            try {
              await draftStorage.set(storageKey, parsed);
              localStorage.removeItem(storageKey);
            } catch (errCache) {
              console.warn('Gagal memperbarui cache tersanitasi:', errCache);
            }
            toast.info(`Draft ${parsed.monthName} ${parsed.year} tersinkronisasi dan dimuat!`);
            return;
          }
        }
      } catch (e) {
        console.warn('Gagal membaca cache lokal:', e);
      }
    }

    try {
      const data = await aggregateMonthlyReportData({
        month: targetMonth,
        year: targetYear,
        preparedBy: 'Arif Budiman',
        contractNumber: 'K.TDE.0105/LEG.PRJ/VI/2026'
      });
      setReportData(data);
      setIsSavedLocally(true);
      // Simpan ke IndexedDB (kapasitas ratusan MB, aman dari QuotaExceededError)
      try {
        await draftStorage.set(storageKey, data);
        localStorage.removeItem(storageKey);
      } catch (errStorage) {
        console.warn('Storage save warning:', errStorage);
      }
      toast.success(`Laporan Bulanan ${data.monthName} ${data.year} Berhasil Digenerate!`);
    } catch (err: any) {
      console.error('Error generating monthly report:', err);
      toast.error(`Gagal membuat laporan: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Generate on initial mount or when month/year changes
  useEffect(() => {
    handleGenerateReport(false, selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Auto-save debounced to IndexedDB when reportData changes
  useEffect(() => {
    if (!reportData) return;
    // CRITICAL GUARD: Hanya simpan jika data laporan cocok dengan bulan & tahun yang aktif!
    if (reportData.monthNumber !== selectedMonth || reportData.year !== selectedYear) {
      return;
    }
    const storageKey = `dwimitra_monthly_report_${selectedYear}_${selectedMonth}`;
    const timeout = setTimeout(async () => {
      try {
        await draftStorage.set(storageKey, reportData);
        setIsSavedLocally(true);
        try { localStorage.removeItem(storageKey); } catch (_) {}
      } catch (e) {
        console.error('Auto-save error:', e);
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, [reportData, selectedMonth, selectedYear]);



  // Quick Action AI Triggers
  const handleAIRecs = () => {
    if (!reportData) return;
    const newRecs = generateRecommendationsFromFindings(reportData.observationTable23);
    setReportData({ ...reportData, recommendationsTable35: newRecs });
    toast.success('Rekomendasi Teknis Bab 11 berhasil disusun oleh AI berdasarkan temuan!');
  };

  const handleAITesting = () => {
    if (!reportData) return;
    const tv = generateTestingAndValidation(reportData.scheduleTable1.map(s => s.device));
    setReportData({
      ...reportData,
      calibrationTable30: tv.calibration,
      validationMethodsTable31: tv.validation
    });
    toast.success('Metode Uji & Validasi Bab 9 berhasil digenerate oleh AI!');
  };

  const handleAIChallenges = () => {
    if (!reportData) return;
    const cm = generateChallengesAndMitigations(reportData.monthName);
    setReportData({
      ...reportData,
      challengesTable32: cm.challenges,
      mitigationTable33: cm.mitigations,
      lessonsLearnedTable34: cm.lessonsLearned
    });
    toast.success('Tantangan, Mitigasi, & Lesson Learned Bab 10 berhasil disusun oleh AI!');
  };

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

  // Reset Draft to Fresh Database Aggregation
  const handleResetToDefault = async () => {
    const currentMonthLabel = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || `Bulan ${selectedMonth}`;
    if (confirm(`Yakin ingin mereset perubahan dan menarik ulang data default ${currentMonthLabel} ${selectedYear} dari database?`)) {
      const storageKey = `dwimitra_monthly_report_${selectedYear}_${selectedMonth}`;
      try {
        await draftStorage.remove(storageKey);
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Gagal menghapus cache saat reset:', e);
      }
      setReportData(null);
      handleGenerateReport(true, selectedMonth, selectedYear);
    }
  };

  // State Loading AI Bilingual Agent
  const [isTranslatingBilingual, setIsTranslatingBilingual] = useState(false);

  // Convert Report to Dual-line Bilingual (EN + ID) with AI Agent
  const handleConvertToBilingual = async () => {
    if (!reportData) return;
    setIsTranslatingBilingual(true);
    const toastId = toast.loading('🤖 AI Agent sedang menyelaraskan format bilingual (EN + ID) untuk seluruh bab & tabel...');
    try {
      const bilingual = await convertReportToBilingualWithAI(reportData, (statusMsg) => {
        toast.loading(`🤖 ${statusMsg}`, { id: toastId });
      });
      setReportData(bilingual);
      toast.success('🎉 100% Seluruh Bab & Tabel berhasil diformat ke Bilingual (Inggris di atas, Indonesia di bawah)!', { id: toastId });
    } catch (err: any) {
      console.warn('AI Agent translation error, using instant baseline:', err);
      const fallback = convertReportToBilingual(reportData);
      setReportData(fallback);
      toast.success('Format Bilingual (EN + ID) berhasil diterapkan!', { id: toastId });
    } finally {
      setIsTranslatingBilingual(false);
    }
  };

  // Handler Upload Foto File Picker (Base64) untuk Bab 12 Tabel 36
  const handlePhotoUpload = (
    file: File | undefined,
    rowIndex: number,
    field: 'prePhoto' | 'duringPhoto' | 'postPhoto'
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto terlalu besar (maksimal 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        const updated = { ...reportData! };
        updated.photoLogsTable36[rowIndex][field] = base64;
        setReportData(updated);
        toast.success('Foto dokumentasi berhasil diunggah!');
      }
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file foto');
    };
    reader.readAsDataURL(file);
  };

  // Handler Hapus Foto dari Sel Tertentu di Bab 12 Tabel 36
  const handleDeleteCellPhoto = (
    rowIndex: number,
    field: 'prePhoto' | 'duringPhoto' | 'postPhoto'
  ) => {
    if (!reportData) return;
    const updated = { ...reportData };
    updated.photoLogsTable36[rowIndex][field] = '';
    setReportData(updated);
    toast.info('Foto berhasil dihapus dari sel');
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
    <div className="space-y-6 pb-24 relative">
      {/* ─── Control Bar (Sembunyi saat Print) ─────────────────────────────────── */}
      <div className="print:hidden bg-white text-slate-800 p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
        {/* Tier 1: Judul Laporan & Selektor Periode */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Interactive Monthly Report Engine (Format Standar NeutraDC Cikarang)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Laporan Bulanan Maintenance (Monthly Report)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Format halaman cetak resmi, tabel Deep Blue (#0066B3), lembar pengesahan 6 signer, dan seluruh tabel
              dapat langsung diedit di web.
            </p>
          </div>

          {/* Month & Year Selectors + Reset in Compact Card */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-center shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 text-slate-400 text-xs font-medium">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline text-slate-600 font-semibold">Periode:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
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
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {[2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y} className="bg-white text-slate-800">
                  {y}
                </option>
              ))}
            </select>

            {/* Refresh / Reset Button */}
            <button
              onClick={handleResetToDefault}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Reset dan Tarik Ulang Data Database"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-5 border-t border-slate-100">
          {/* Smart Features / AI Tools */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Bilingual (EN + ID) Button with AI Agent */}
            <button
              onClick={handleConvertToBilingual}
              disabled={!reportData || isTranslatingBilingual}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="Konversi seluruh tabel dan narasi ke Format Bilingual resmi NeutraDC dengan bantuan AI Agent"
            >
              {isTranslatingBilingual ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Globe className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isTranslatingBilingual ? 'AI Menerjemahkan...' : 'Format Bilingual (EN + ID)'}</span>
            </button>

          </div>

          {/* Export & Output Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-sm shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>

            {/* Export to Word (.docx) Button */}
            <button
              onClick={handleExportDocx}
              disabled={exportingDocx || !reportData}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exportingDocx ? 'Menyusun Word...' : 'Ekspor Word (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Badges */}
        {reportData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Sistem Terjadwal Bab 2</span>
              <span className="text-xl font-black text-slate-800">
                {reportData.scheduleTable1.length} Lingkup Sistem
              </span>
            </div>
            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/60">
              <span className="text-xs text-emerald-700 font-medium block">Critical Uptime</span>
              <span className="text-xl font-black text-emerald-700">100.00%</span>
            </div>
            <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200/60">
              <span className="text-xs text-indigo-700 font-medium block">Status Auto-Save Web</span>
              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isSavedLocally ? 'Tersimpan di Browser' : 'Menyimpan...'}</span>
              </span>
            </div>
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/60">
              <span className="text-xs text-amber-700 font-medium block">Suku Cadang CM Standby (Bab 8)</span>
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
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-12 space-y-16 print:border-none print:shadow-none print:p-0" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          
          {/* ===================================================================
              PAGE 1: COVER PAGE (100% CENTERED & BILINGUAL SESUAI ACUAN ASLI)
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="min-h-[88vh] flex flex-col justify-between py-16 px-8 border-b border-slate-200 print:border-none print:page-break-after font-serif text-center">
              {/* Top Header Block (Centered) */}
              <div className="space-y-6 pt-16 text-center max-w-4xl mx-auto w-full">
                <div className="space-y-3">
                  <BilingualTextarea
                    value={reportData.coverTitle || 'PREVENTIVE MAINTENANCE REPORT\nLAPORAN PEMELIHARAAN PREVENTIF'}
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.coverTitle = val;
                      setReportData(updated);
                    }}
                    placeholderEn="PREVENTIVE MAINTENANCE REPORT"
                    placeholderId="LAPORAN PEMELIHARAAN PREVENTIF (garis miring)..."
                    classNameEn="text-3xl sm:text-4xl lg:text-[40px] font-serif font-black text-slate-900 leading-tight w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide"
                    classNameId="text-2xl sm:text-3xl lg:text-[32px] font-serif font-bold italic text-slate-600 leading-tight w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide"
                    indentId={false}
                  />
                  <textarea
                    rows={reportData.coverSubtitle?.includes('\n') ? 2 : 1}
                    value={reportData.coverSubtitle || `${reportData.quarter}-${reportData.monthNameEn.toUpperCase()} ${reportData.year}`}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.coverSubtitle = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-2xl sm:text-3xl lg:text-[32px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide mt-1 resize-none leading-tight"
                    placeholder="Quarter - Bulan Tahun..."
                  />
                </div>
                <div className="pt-2">
                  <input
                    type="text"
                    value={reportData.docCode.startsWith('Ref No:') ? reportData.docCode : `Ref No: ${reportData.docCode}`}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.docCode = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm sm:text-base font-serif text-slate-900 font-bold w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                    placeholder="Ref No: DME-TDE/MR/..."
                  />
                </div>
              </div>

              {/* Bottom Institutional Block (Centered) */}
              <div className="space-y-2 pb-28 text-center max-w-4xl mx-auto w-full">
                <input
                  type="text"
                  value={reportData.projectName}
                  onChange={(e) => {
                    const updated = { ...reportData };
                    updated.projectName = e.target.value;
                    setReportData(updated);
                  }}
                  className="text-2xl sm:text-3xl lg:text-[30px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                  placeholder="Lokasi Fasilitas..."
                />
                <input
                  type="text"
                  value={reportData.clientName}
                  onChange={(e) => {
                    const updated = { ...reportData };
                    updated.clientName = e.target.value;
                    setReportData(updated);
                  }}
                  className="text-xl sm:text-2xl lg:text-[26px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                  placeholder="Nama Klien..."
                />
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 2: LEMBAR PENGESAHAN (APPROVAL SHEET)
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="space-y-8 border-b border-slate-200 pb-12 print:border-none print:page-break-after">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="text-center space-y-1 mb-8">
                <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-tight">
                  APPROVAL SHEET
                </h2>
                <p className="text-base sm:text-lg font-serif italic text-slate-600">
                  LEMBAR PENGESAHAN
                </p>

                <div className="max-w-4xl mx-auto pt-4 px-2">
                  <BilingualTextarea
                    value={
                      reportData.approvalSheetStatement !== undefined
                        ? reportData.approvalSheetStatement
                        : `This Monthly Report for ${reportData.monthNameEn || 'July'} ${reportData.year || 2026} has been duly prepared, reviewed, and approved by the respective authorized parties as evidence of acknowledgment and acceptance of the activities and documentation presented herein.\nDemikian Monthly Report ${reportData.monthName || 'Juli'} ${reportData.year || 2026} ini telah disusun, diperiksa, dan disetujui oleh pihak-pihak yang berwenang sebagai bentuk pengesahan dan persetujuan atas seluruh kegiatan serta dokumentasi yang tercantum di dalam laporan ini.`
                    }
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.approvalSheetStatement = val;
                      setReportData(updated);
                    }}
                    placeholderEn="Statement in English..."
                    placeholderId="Pernyataan dalam Bahasa Indonesia (garis miring)..."
                    classNameEn="text-center text-xs sm:text-[13px] font-serif text-slate-800 leading-relaxed bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none w-full"
                    classNameId="text-center text-[11px] sm:text-xs font-serif italic text-slate-600 leading-relaxed bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none w-full"
                    indentId={false}
                  />
                </div>
              </div>

              {/* 6-Signer Grid: 2 Columns x 3 Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10 max-w-4xl mx-auto text-center font-serif">
                {/* Row 1: Prepared by Arif Budiman vs Reviewed by Dwi Tasmiyadi */}
                <div className="space-y-1">
                  <textarea
                    rows={reportData.approvalSheet.preparedBy.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.preparedBy.title || 'Prepared By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <img src={ARIF_BUDIMAN_SIGNATURE_BASE64} alt="TTD Arif Budiman" className="h-16 object-contain" />
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.preparedBy.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.preparedBy.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy1.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy1.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy1.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy1.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                {/* Row 2: Reviewed by Habib Mulyana vs Supriyatno (OCS) */}
                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy2.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy2.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy2.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy2.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy3.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy3.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy3.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy3.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                {/* Row 3: Approved by Budi Susanto vs Rezki Rahman Daulay (TDE) */}
                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.approvedBy1.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.approvedBy1.title || 'Approved By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Approved ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy1.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy1.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.approvedBy2.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.approvedBy2.title || 'Approved By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Approved ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy2.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy2.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>
              </div>

              <TelkomPageFooter pageNumber={2} />
            </section>
          )}

          {/* ===================================================================
              PAGE 3: TABLE OF CONTENTS (DAFTAR ISI) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || window.matchMedia('print').matches) && (
            <section className="space-y-6 border-b border-slate-200 pb-12 print:border-none print:page-break-after font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between max-w-3xl mx-auto mb-4">
                <h2 className="text-2xl font-serif font-bold text-blue-900">
                  Table of Contents
                </h2>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    if (!updated.tableOfContents) {
                      updated.tableOfContents = [
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
                      ];
                    }
                    const nextNum = updated.tableOfContents.length + 1;
                    updated.tableOfContents.push({
                      title: `${nextNum}. Bab Baru`,
                      page: '270'
                    });
                    setReportData(updated);
                    toast.success('Bab baru ditambahkan ke Daftar Isi!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Bab</span>
                </button>
              </div>

              <div className="max-w-3xl mx-auto font-serif text-sm space-y-1.5 text-slate-800">
                {(reportData.tableOfContents || [
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
                ]).map((item, idx) => (
                  <div key={idx} className="group flex items-center justify-between border-b border-dotted border-black pb-1 gap-4">
                    <BilingualTextarea
                      value={item.title}
                      onChange={(val) => {
                        const updated = { ...reportData };
                        if (!updated.tableOfContents) {
                          updated.tableOfContents = [
                            { title: '1. Executive Summary\nRingkasan Eksekutif', page: '5' },
                            { title: '2. Key Highlight\nSorotan Utama & Jadwal Pemeliharaan', page: '5' },
                            { title: '3. General Information\nInformasi Umum & Tim Pemeliharaan', page: '218' },
                            { title: '4. Maintenance Objectives\nTujuan Pemeliharaan & Indikator Kinerja', page: '218' },
                            { title: '5. Equipment and System Details\nDetail Peralatan dan Daftar Aset', page: '220' },
                            { title: '6. Scope of Work\nRuang Lingkup Pekerjaan Pemeliharaan', page: '238' },
                            { title: '7. Observation and Finding\nObservasi Lapangan & Temuan Inspeksi', page: '252' },
                            { title: '8. Repairs, Replacement & Services\nPerbaikan, Penggantian Suku Cadang & Servis', page: '256' },
                            { title: '9. Testing & Validation\nPengujian & Validasi Metode Kerja', page: '258' },
                            { title: '10. Challenges, Mitigation and Lesson Learned\nTantangan, Langkah Mitigasi & Pembelajaran', page: '259' },
                            { title: '11. Recommendations and Future Action\nRekomendasi & Rencana Tindak Lanjut', page: '264' },
                            { title: '12. Photo and Documentation Log\nLog Foto dan Dokumentasi Visual', page: '265' },
                            { title: '13. Appendices\nLampiran Dokumen Servis Resmi', page: '268' }
                          ];
                        }
                        updated.tableOfContents[idx].title = val;
                        setReportData(updated);
                      }}
                      placeholderEn="Chapter Title..."
                      placeholderId="Judul Bab Bahasa Indonesia (garis miring)..."
                      classNameEn="font-bold text-slate-900 text-sm bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      classNameId="italic text-slate-600 text-xs bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      containerClassName="flex-1 flex flex-col space-y-0.5"
                      indentId={true}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.page}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          if (!updated.tableOfContents) {
                            updated.tableOfContents = [
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
                            ];
                          }
                          updated.tableOfContents[idx].page = e.target.value;
                          setReportData(updated);
                        }}
                        className="font-bold text-slate-800 w-16 text-right bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button
                        onClick={() => {
                          const updated = { ...reportData };
                          if (!updated.tableOfContents) {
                            updated.tableOfContents = [
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
                            ];
                          }
                          updated.tableOfContents.splice(idx, 1);
                          setReportData(updated);
                          toast.info('Bab dihapus dari Daftar Isi.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus bab"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <TelkomPageFooter pageNumber={3} />
            </section>
          )}

          {/* ===================================================================
              LIST OF TABLES (DAFTAR TABEL) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif pt-8 border-t border-slate-200">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-center text-[#0066B3] flex-1">
                  List of Tables
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...reportData };
                    const currentTables = updated.listOfTables ? [...updated.listOfTables] : [
                      { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                      { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                      { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                      { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                      { title: 'Table 5. Task Performance – Transformer', page: '12' },
                      { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                      { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                      { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                      { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                      { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                      { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                      { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                      { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                      { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                      { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                      { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                      { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                      { title: 'Table 18. Team Composition', page: '218' },
                      { title: 'Table 19. KPI Metric', page: '218' },
                      { title: 'Table 20. Equipment and System Details', page: '220' },
                      { title: 'Table 21. System Overview', page: '236' },
                      { title: 'Table 22. Scope of Work', page: '238' },
                      { title: 'Table 23. Observation & Finding', page: '252' },
                      { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                      { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                      { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                      { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                      { title: 'Table 28. Finding Severity Matrix', page: '255' },
                      { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                      { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                      { title: 'Table 31. Validation Methods', page: '258' },
                      { title: 'Table 32. Challenges Faced', page: '259' },
                      { title: 'Table 33. Mitigation Steps', page: '261' },
                      { title: 'Table 34. Lessons Learned', page: '263' },
                      { title: 'Table 35. Recommendations and Future Action', page: '264' },
                      { title: 'Table 36. Photo and Documentation Log', page: '265' }
                    ];
                    const nextNo = currentTables.length + 1;
                    currentTables.push({
                      title: `Table ${nextNo}. Judul Tabel Tambahan`,
                      page: '1'
                    });
                    updated.listOfTables = currentTables;
                    setReportData(updated);
                    toast.success('Tabel baru berhasil ditambahkan ke List of Tables!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tabel</span>
                </button>
              </div>

              <div className="space-y-1 text-sm max-w-3xl mx-auto divide-y divide-slate-100">
                {(reportData.listOfTables || [
                  { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                  { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                  { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                  { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                  { title: 'Table 5. Task Performance – Transformer', page: '12' },
                  { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                  { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                  { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                  { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                  { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                  { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                  { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                  { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                  { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                  { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                  { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                  { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                  { title: 'Table 18. Team Composition', page: '218' },
                  { title: 'Table 19. KPI Metric', page: '218' },
                  { title: 'Table 20. Equipment and System Details', page: '220' },
                  { title: 'Table 21. System Overview', page: '236' },
                  { title: 'Table 22. Scope of Work', page: '238' },
                  { title: 'Table 23. Observation & Finding', page: '252' },
                  { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                  { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                  { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                  { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                  { title: 'Table 28. Finding Severity Matrix', page: '255' },
                  { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                  { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                  { title: 'Table 31. Validation Methods', page: '258' },
                  { title: 'Table 32. Challenges Faced', page: '259' },
                  { title: 'Table 33. Mitigation Steps', page: '261' },
                  { title: 'Table 34. Lessons Learned', page: '263' },
                  { title: 'Table 35. Recommendations and Future Action', page: '264' },
                  { title: 'Table 36. Photo and Documentation Log', page: '265' }
                ]).map((item, idx) => (
                  <div key={idx} className="group flex items-center justify-between gap-4 py-1.5 hover:bg-blue-50/40 px-2 rounded-lg transition-colors">
                    <BilingualTextarea
                      value={item.title}
                      onChange={(val) => {
                        const updated = { ...reportData };
                        const list = updated.listOfTables ? [...updated.listOfTables] : [];
                        list[idx].title = val;
                        updated.listOfTables = list;
                        setReportData(updated);
                      }}
                      placeholderEn="Table Title..."
                      placeholderId="Judul Tabel Bahasa Indonesia (garis miring)..."
                      classNameEn="font-medium text-slate-900 text-sm bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      classNameId="italic text-slate-600 text-xs bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      containerClassName="flex-1 flex flex-col space-y-0.5"
                      indentId={true}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.page}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          const list = updated.listOfTables ? [...updated.listOfTables] : [
                            { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                            { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                            { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                            { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                            { title: 'Table 5. Task Performance – Transformer', page: '12' },
                            { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                            { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                            { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                            { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                            { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                            { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                            { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                            { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                            { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                            { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                            { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                            { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                            { title: 'Table 18. Team Composition', page: '218' },
                            { title: 'Table 19. KPI Metric', page: '218' },
                            { title: 'Table 20. Equipment and System Details', page: '220' },
                            { title: 'Table 21. System Overview', page: '236' },
                            { title: 'Table 22. Scope of Work', page: '238' },
                            { title: 'Table 23. Observation & Finding', page: '252' },
                            { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                            { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                            { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                            { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                            { title: 'Table 28. Finding Severity Matrix', page: '255' },
                            { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                            { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                            { title: 'Table 31. Validation Methods', page: '258' },
                            { title: 'Table 32. Challenges Faced', page: '259' },
                            { title: 'Table 33. Mitigation Steps', page: '261' },
                            { title: 'Table 34. Lessons Learned', page: '263' },
                            { title: 'Table 35. Recommendations and Future Action', page: '264' },
                            { title: 'Table 36. Photo and Documentation Log', page: '265' }
                          ];
                          list[idx].page = e.target.value;
                          updated.listOfTables = list;
                          setReportData(updated);
                        }}
                        className="font-bold text-slate-800 w-16 text-right bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...reportData };
                          const list = updated.listOfTables ? [...updated.listOfTables] : [
                            { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                            { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                            { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                            { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                            { title: 'Table 5. Task Performance – Transformer', page: '12' },
                            { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                            { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                            { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                            { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                            { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                            { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                            { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                            { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                            { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                            { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                            { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                            { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                            { title: 'Table 18. Team Composition', page: '218' },
                            { title: 'Table 19. KPI Metric', page: '218' },
                            { title: 'Table 20. Equipment and System Details', page: '220' },
                            { title: 'Table 21. System Overview', page: '236' },
                            { title: 'Table 22. Scope of Work', page: '238' },
                            { title: 'Table 23. Observation & Finding', page: '252' },
                            { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                            { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                            { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                            { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                            { title: 'Table 28. Finding Severity Matrix', page: '255' },
                            { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                            { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                            { title: 'Table 31. Validation Methods', page: '258' },
                            { title: 'Table 32. Challenges Faced', page: '259' },
                            { title: 'Table 33. Mitigation Steps', page: '261' },
                            { title: 'Table 34. Lessons Learned', page: '263' },
                            { title: 'Table 35. Recommendations and Future Action', page: '264' },
                            { title: 'Table 36. Photo and Documentation Log', page: '265' }
                          ];
                          list.splice(idx, 1);
                          updated.listOfTables = list;
                          setReportData(updated);
                          toast.info('Tabel dihapus dari List of Tables.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus baris tabel"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <TelkomPageFooter pageNumber={4} />
            </section>
          )}

          {/* ===================================================================
              BAB 1 & BAB 2: EXECUTIVE SUMMARY & KEY HIGHLIGHT (TABEL 1 - 17) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || activeChapter === 2 || window.matchMedia('print').matches) && (
            <section className="space-y-6">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="font-serif space-y-4 text-slate-800 leading-relaxed text-sm">
                <h2 className="text-xl font-bold text-slate-900">1. Executive Summary</h2>
                <BilingualTextarea
                  value={reportData.executiveSummaryText !== undefined ? reportData.executiveSummaryText : 'Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).'}
                  onChange={(val) => {
                    const updated = { ...reportData };
                    updated.executiveSummaryText = val;
                    setReportData(updated);
                  }}
                  placeholderEn="Executive summary narrative in English..."
                  placeholderId="Narasi ringkasan eksekutif Bahasa Indonesia (garis miring)..."
                  classNameEn="w-full text-sm font-serif leading-relaxed text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg p-2 outline-none"
                  classNameId="w-full text-xs font-serif italic leading-relaxed text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg p-2 outline-none"
                  indentId={true}
                />

                <div className="flex items-center justify-between pt-2">
                  <BilingualTextarea
                    value={reportData.purposeOfReportTitle || 'Purpose of Report'}
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.purposeOfReportTitle = val;
                      setReportData(updated);
                    }}
                    placeholderEn="Purpose of Report"
                    placeholderId="Tujuan Laporan (garis miring)..."
                    classNameEn="text-base font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none leading-tight font-serif"
                    classNameId="text-xs italic font-semibold text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none leading-tight font-serif"
                    containerClassName="flex-1 flex flex-col space-y-0.5"
                    indentId={true}
                  />
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      if (!updated.purposePoints) {
                        updated.purposePoints = [
                          { title: 'Documentation of Preventive Maintenance Activities:\nDokumentasi Kegiatan Pemeliharaan Preventif:', desc: 'Records all PM activities that have been carried out for one month.\nMencatat seluruh aktivitas PM yang telah dilaksanakan selama satu bulan.' },
                          { title: 'Equipment and System Performance Evaluation:\nEvaluasi Kinerja Peralatan dan Sistem:', desc: 'Assess the condition of equipment based on inspection and maintenance results.\nMenilai kondisi fisik dan performa operasional peralatan berdasarkan hasil inspeksi.' },
                          { title: 'Reporting to Management:\nPelaporan kepada Manajemen Fasilitas:', desc: 'Provides management with a comprehensive overview of the condition of the facility.\nMemberikan gambaran menyeluruh kepada manajemen mengenai keandalan fasilitas.' },
                          { title: 'Ensure Compliance with Procedures and Standards:\nMemastikan Kepatuhan terhadap Prosedur dan Standar:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures.\nMemverifikasi bahwa kegiatan PM dilaksanakan sesuai prosedur resmi data center.' }
                        ];
                      }
                      updated.purposePoints.push({
                        title: 'Technical Compliance Assurance:\nJaminan Kepatuhan Teknis:',
                        desc: 'Maintain zero-interruption uptime and regulatory data center compliance.\nMenjaga ketersediaan tanpa jeda dan kepatuhan regulasi operasional fasilitas.'
                      });
                      setReportData(updated);
                      toast.success('Poin tujuan berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Poin Tujuan</span>
                  </button>
                </div>

                <BilingualTextarea
                  value={reportData.purposeOfReportIntro !== undefined ? reportData.purposeOfReportIntro : 'To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:'}
                  onChange={(val) => {
                    const updated = { ...reportData };
                    updated.purposeOfReportIntro = val;
                    setReportData(updated);
                  }}
                  placeholderEn="To document, evaluate, and ensure that maintenance activities..."
                  placeholderId="Untuk mendokumentasikan, mengevaluasi... (garis miring)"
                  classNameEn="w-full text-sm font-serif text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none"
                  classNameId="w-full text-xs font-serif italic text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none"
                  indentId={true}
                />

                <ol className="list-decimal pl-6 space-y-3">
                  {(reportData.purposePoints || [
                    { title: 'Documentation of Preventive Maintenance Activities:\nDokumentasi Kegiatan Pemeliharaan Preventif:', desc: 'Records all PM activities that have been carried out for one month.\nMencatat seluruh aktivitas PM yang telah dilaksanakan selama satu bulan.' },
                    { title: 'Equipment and System Performance Evaluation:\nEvaluasi Kinerja Peralatan dan Sistem:', desc: 'Assess the condition of equipment based on inspection and maintenance results.\nMenilai kondisi fisik dan performa operasional peralatan berdasarkan hasil inspeksi.' },
                    { title: 'Reporting to Management:\nPelaporan kepada Manajemen Fasilitas:', desc: 'Provides management with a comprehensive overview of the condition of the facility.\nMemberikan gambaran menyeluruh kepada manajemen mengenai keandalan fasilitas.' },
                    { title: 'Ensure Compliance with Procedures and Standards:\nMemastikan Kepatuhan terhadap Prosedur dan Standar:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures.\nMemverifikasi bahwa kegiatan PM dilaksanakan sesuai prosedur resmi data center.' }
                  ]).map((pt, pIdx) => (
                    <li key={pIdx} className="group relative pr-8">
                      <div className="space-y-1">
                        <BilingualTextarea
                          value={pt.title}
                          onChange={(val) => {
                            const updated = { ...reportData };
                            if (!updated.purposePoints) updated.purposePoints = [];
                            updated.purposePoints[pIdx].title = val;
                            setReportData(updated);
                          }}
                          placeholderEn="Purpose Title in English..."
                          placeholderId="Judul Tujuan Bahasa Indonesia (garis miring)..."
                          classNameEn="font-bold text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-sm leading-tight font-serif"
                          classNameId="italic font-semibold text-slate-600 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-xs leading-tight font-serif"
                          indentId={true}
                        />
                        <BilingualTextarea
                          value={pt.desc}
                          onChange={(val) => {
                            const updated = { ...reportData };
                            if (!updated.purposePoints) updated.purposePoints = [];
                            updated.purposePoints[pIdx].desc = val;
                            setReportData(updated);
                          }}
                          placeholderEn="Purpose Description in English..."
                          placeholderId="Deskripsi Tujuan Bahasa Indonesia (garis miring)..."
                          classNameEn="w-full text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-xs leading-relaxed font-serif"
                          classNameId="w-full text-slate-600 italic bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-[11.5px] leading-relaxed font-serif"
                          indentId={true}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const updated = { ...reportData };
                          if (!updated.purposePoints) {
                            updated.purposePoints = [
                              { title: 'Documentation of Preventive Maintenance Activities:', desc: 'Records all PM activities that have been carried out for one month. Include details such as schedule, equipment maintained, methods used, inspection results, and corrective actions if any.' },
                              { title: 'Equipment and System Performance Evaluation:', desc: 'Assess the condition of equipment based on inspection and maintenance results.' },
                              { title: 'Reporting to Management:', desc: 'Provides management with a comprehensive overview of the condition of the facility and the effectiveness of the PM program.' },
                              { title: 'Ensure Compliance with Procedures and Standards:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures and regulations (e.g. national/international standards).' }
                            ];
                          }
                          updated.purposePoints.splice(pIdx, 1);
                          setReportData(updated);
                          toast.info('Poin tujuan dihapus.');
                        }}
                        className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus poin"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="pt-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">2. Key Highlight</h2>
                  <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 font-sans font-medium print:hidden">
                    💡 Klik kolom Actual / Status untuk mengedit
                  </span>
                </div>

                <p className="font-bold text-center text-slate-900 text-sm my-3">
                  Table 1. Schedule Maintenance – {reportData.monthNameEn} {reportData.year}
                </p>
              </div>

              {/* Tabel 1: Schedule Maintenance - Deep Blue Header & Fully Editable */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-sans">
                  💡 Semua kolom tabel (Device, Lokasi, Plan, Actual, Status) dapat diedit langsung.
                </span>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.scheduleTable1.length + 1;
                    updated.scheduleTable1.push({
                      no: newNo,
                      device: 'New Equipment',
                      location: 'Campus Area',
                      maintenancePartner: 'PT. Dwimitra Ekatama Mandiri',
                      plan: `01 - 05 ${reportData.monthNameEn}`,
                      actual: '',
                      status: '',
                      engineerAccount: 'PT. Dwimitra Ekatama Mandiri'
                    });
                    setReportData(updated);
                    toast.success('Baris jadwal baru berhasil ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Jadwal</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-black shadow-sm">
                <table className="w-full text-center text-xs font-serif border-collapse">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[20%]">Device</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[18%]">Location</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[26%]">Maintenance Partner</th>
                      <th colSpan={2} className="py-1.5 px-3 text-center border-r border-black font-bold">{reportData.monthNameEn}</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[14%]">Status</th>
                      <th rowSpan={2} className="py-2.5 px-2 text-center w-10 border-black align-middle print:hidden">Aksi</th>
                    </tr>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-1.5 px-2 text-center border-r border-black w-[11%]">Plan</th>
                      <th className="py-1.5 px-2 text-center border-r border-black w-[11%]">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-900">
                    {reportData.scheduleTable1.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="py-1.5 px-2 font-bold border-r border-black text-center">
                          <input
                            type="text"
                            value={item.device}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].device = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black text-center">
                          <input
                            type="text"
                            value={item.location}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].location = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black text-center">
                          <input
                            type="text"
                            value={item.maintenancePartner}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].maintenancePartner = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={item.plan}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].plan = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={item.actual}
                            placeholder="Input actual..."
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].actual = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:italic placeholder:text-slate-300 font-medium"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <BilingualTextarea
                            value={item.status}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].status = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Status (EN)..."
                            placeholderId="Status (ID - garis miring)..."
                            classNameEn="w-full text-center text-xs font-semibold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            classNameId="w-full text-center text-[10px] italic text-slate-500 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            indentId={false}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.scheduleTable1.splice(idx, 1);
                              updated.scheduleTable1.forEach((s, i) => { s.no = i + 1; });
                              setReportData(updated);
                              toast.info('Baris jadwal dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Task Performance Scope Tables (Tabel 2 - 17) */}
              <div className="space-y-8 pt-8">
                {reportData.taskPerformanceTables.map((tTable, tIdx) => (
                  <div key={tIdx} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 text-sm font-serif">
                        {tTable.title}
                      </p>
                      <button
                        onClick={() => {
                          const updated = { ...reportData };
                          const newNo = updated.taskPerformanceTables[tIdx].items.length + 1;
                          updated.taskPerformanceTables[tIdx].items.push({
                            no: newNo,
                            className: `${tTable.scope} #${newNo}`,
                            capacity: 'Standard Rating',
                            location: 'NeutraDC Campus',
                            productName: 'OEM Certified',
                            taskPM: 'Inspection, cleaning, parameter checks, and functional testing.',
                            criticalRepairs: '-',
                            operationalStatus: 'Good Condition / Normal Operation',
                            issues: '-',
                            recommendations: '-'
                          });
                          setReportData(updated);
                          toast.success(`Baris baru ditambahkan ke ${tTable.scope}!`);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambah Alat {tTable.scope}</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-black">
                      <table className="w-full text-left text-[11px] font-serif border-collapse">
                        <thead>
                          <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                            <th className="py-2.5 px-2 text-center w-8 border-r border-black">No</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Class Name</th>
                            <th className="py-2.5 px-2 border-r border-black w-24">Capacity</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Location</th>
                            <th className="py-2.5 px-2 border-r border-black w-24">Product Name</th>
                            <th className="py-2.5 px-2 border-r border-black">Task Preventive Maintenance</th>
                            <th className="py-2.5 px-2 border-r border-black w-24">Critical Repairs</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Operational Status</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Issues</th>
                            <th className="py-2.5 px-2 w-28 border-r border-black">Recommendations</th>
                            <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black text-slate-800">
                          {tTable.items.map((item, iIdx) => (
                            <tr key={iIdx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-1 text-center font-bold border-r border-black">{item.no}</td>
                              <td className="py-1 px-1 border-r border-black font-bold">
                                <input
                                  type="text"
                                  value={item.className}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].className = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={item.capacity}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].capacity = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].location = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black font-bold">
                                <input
                                  type="text"
                                  value={item.productName}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].productName = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px]">
                                <BilingualBulletsEditor
                                  value={item.taskPM}
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].taskPM = val;
                                    setReportData(updated);
                                  }}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px]">
                                <BilingualTextarea
                                  value={item.criticalRepairs}
                                  placeholderEn="No critical repair..."
                                  placeholderId="Tidak ada perbaikan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].criticalRepairs = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-slate-800"
                                  classNameId="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black font-semibold text-[10px]">
                                <BilingualTextarea
                                  value={item.operationalStatus}
                                  placeholderEn="Good Condition..."
                                  placeholderId="Kondisi Baik... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].operationalStatus = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] font-semibold leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-slate-800"
                                  classNameId="w-full text-[9.5px] font-semibold italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px] text-amber-900">
                                <BilingualTextarea
                                  value={item.issues}
                                  placeholderEn="No abnormality..."
                                  placeholderId="Tidak ditemukan kelainan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].issues = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-amber-900"
                                  classNameId="w-full text-[9.5px] italic text-amber-800/80 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px] text-blue-900">
                                <BilingualTextarea
                                  value={item.recommendations}
                                  placeholderEn="Continue routine..."
                                  placeholderId="Lanjutkan pemantauan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].recommendations = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-blue-900"
                                  classNameId="w-full text-[9.5px] italic text-blue-800/80 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 text-center print:hidden">
                                <button
                                  onClick={() => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items.splice(iIdx, 1);
                                    updated.taskPerformanceTables[tIdx].items.forEach((it, idx) => { it.no = idx + 1; });
                                    setReportData(updated);
                                    toast.info('Baris peralatan dihapus.');
                                  }}
                                  className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3 h-3 mx-auto text-slate-400 hover:text-red-600" />
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
              <div className="text-xs space-y-2 text-slate-800 font-sans">
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Maintenance Type :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.maintenanceType}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.maintenanceType = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Contract Reference :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.contractReference}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.contractReference = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Timeline :</span>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={reportData.generalInfo.timeline.startDate}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.timeline.startDate = e.target.value;
                        setReportData(updated);
                      }}
                      className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs text-center"
                    />
                    <span>s/d</span>
                    <input
                      type="text"
                      value={reportData.generalInfo.timeline.endDate}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.timeline.endDate = e.target.value;
                        setReportData(updated);
                      }}
                      className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Total Hours Worked :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.timeline.totalHoursWorked}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.timeline.totalHoursWorked = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Standard Followed :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.timeline.standardsFollowed.join(', ')}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.timeline.standardsFollowed = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <p className="font-bold text-slate-900 text-sm font-serif">
                  Table 18. Team Composition
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.generalInfo.teamMembers.push('Nama Anggota Baru');
                    setReportData(updated);
                    toast.success('Anggota tim baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Anggota Tim</span>
                </button>
              </div>

              <div className="max-w-2xl mx-auto border border-black overflow-hidden text-xs font-serif">
                <div className="bg-[#92B8DE] p-3 text-center border-b border-black space-y-1">
                  <span className="font-bold text-slate-900 block">Team Leader</span>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="text"
                      value={reportData.generalInfo.teamLeader.name}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.teamLeader.name = e.target.value;
                        setReportData(updated);
                      }}
                      className="font-bold text-slate-900 text-center bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none"
                    />
                    <span>/</span>
                    <div className="inline-block min-w-[140px]">
                      <BilingualTextarea
                        value={reportData.generalInfo.teamLeader.role}
                        onChange={(val) => {
                          const updated = { ...reportData };
                          updated.generalInfo.teamLeader.role = val;
                          setReportData(updated);
                        }}
                        placeholderEn="Role (EN)..."
                        placeholderId="Peran (ID - garis miring)..."
                        classNameEn="w-full text-center text-xs font-semibold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                        classNameId="w-full text-center text-[10.5px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                        indentId={false}
                      />
                    </div>
                    <span>/</span>
                    <input
                      type="text"
                      value={reportData.generalInfo.teamLeader.phone}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.teamLeader.phone = e.target.value;
                        setReportData(updated);
                      }}
                      className="text-slate-800 text-center bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none"
                    />
                  </div>
                </div>
                <div className="bg-[#0066B3] text-white p-2 text-center font-bold border-b border-black">
                  Team Member
                </div>
                <div className="grid grid-cols-3 divide-x divide-y divide-black text-center font-medium">
                  {reportData.generalInfo.teamMembers.map((tm, idx) => (
                    <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-1 group">
                      <input
                        type="text"
                        value={tm}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.generalInfo.teamMembers[idx] = e.target.value;
                          setReportData(updated);
                        }}
                        className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-medium text-slate-800"
                      />
                      <button
                        onClick={() => {
                          const updated = { ...reportData };
                          updated.generalInfo.teamMembers.splice(idx, 1);
                          setReportData(updated);
                          toast.info('Anggota tim dihapus.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                      </button>
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

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">4. Maintenance Objectives & KPI Metrics</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Ringkasan KPI Pemeliharaan Preventif, SLA Respon Insiden, dan Matriks Kredit Layanan</p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const monthNameEn = updated.monthNameEn || 'July';
                      const mNum = updated.monthNumber || 7;
                      const monthIdx = mNum - 1;

                      // 1. Reset Progress PM Table (Foto 1 Atas)
                      const scheduledForMonth = MASTER_PM_SCHEDULES.filter(s => s.months[monthIdx] !== null);
                      let count = 1;
                      let totalPctSum = 0;
                      updated.progressPmTable19 = scheduledForMonth.map(item => {
                        const rawMonthPlan = item.months[monthIdx] || '10 - 20';
                        let planStart = `10 ${monthNameEn}`;
                        let planFinish = `20 ${monthNameEn}`;
                        if (rawMonthPlan.includes('-')) {
                          const parts = rawMonthPlan.split('-').map(p => p.trim());
                          planStart = `${parts[0]} ${monthNameEn}`;
                          planFinish = `${parts[1]} ${monthNameEn}`;
                        }
                        const unit = getDefaultBoqUnitForDevice(item.device);
                        let actualStart = planStart;
                        let actualFinish = planFinish;
                        let actualUnit: number | string = unit;
                        let pctFinish = '100%';
                        let remark = '';

                        if (mNum === 7) {
                          if (item.device === 'Water Leak') {
                            actualStart = `7 ${monthNameEn}`;
                            actualFinish = `9 ${monthNameEn}`;
                          } else if (item.device === 'Cooling Tower Water Treatment') {
                            actualStart = `8 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          } else if (item.device === 'Lift Units') {
                            actualStart = `7 ${monthNameEn}`;
                            actualFinish = `14 ${monthNameEn}`;
                          } else if (item.device === 'Gate') {
                            actualStart = `27 ${monthNameEn}`;
                            actualFinish = `28 ${monthNameEn}`;
                          } else if (item.device === 'Dock Leveler') {
                            actualStart = `10 ${monthNameEn}`;
                            actualFinish = `11 ${monthNameEn}`;
                          } else if (item.device === 'STP & Plumbing') {
                            actualStart = `30 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          } else if (item.device === 'Door') {
                            actualStart = `15 ${monthNameEn}`;
                            actualFinish = `17 ${monthNameEn}`;
                          } else if (item.device === 'Exhaust Fan') {
                            actualStart = `27 ${monthNameEn}`;
                            actualFinish = `31 ${monthNameEn}`;
                            actualUnit = 8;
                            pctFinish = '66,67%';
                            remark = '1F-RM-TES TANK-1 dan 1F-RM-TES TANK-2 Access susah (terlalu tinggi), dan 1F-RM CHILLER FAN-1 dan 1F-RM CHILLER FAN-2 ada pekerjaan project';
                          } else if (item.device === 'Capacitor Bank') {
                            actualStart = `29 ${monthNameEn}`;
                            actualFinish = `29 ${monthNameEn}`;
                          } else if (item.device === 'Load Bank') {
                            actualStart = `30 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          }
                        }
                        const numPct = parseFloat(pctFinish.replace(',', '.').replace('%', '')) || 100;
                        totalPctSum += numPct;
                        return {
                          no: `${count++}.`,
                          activity: item.device,
                          unit,
                          planStart,
                          planFinish,
                          actualStart,
                          actualFinish,
                          actualUnit,
                          pctFinish,
                          remark
                        };
                      });
                      const avgNum = updated.progressPmTable19.length > 0 ? (totalPctSum / updated.progressPmTable19.length) : 100;
                      updated.progressPmAverage = mNum === 7 ? '97,44%' : `${avgNum.toFixed(2).replace('.', ',')}%`;

                      // 2. Reset SLA Orders Table (Foto 1 Bawah)
                      updated.slaOrdersTable19 = [
                        { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
                        { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                        { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                        { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
                      ];
                      updated.slaOrdersPeriodTotal = '%';

                      // 3. Reset Service Credit Matrix (Foto 2)
                      updated.serviceCreditMatrix = [
                        { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                        { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                        { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                        { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                        { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                        { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                      ];

                      setReportData(updated);
                      toast.success('Format Tabel 19 KPI Metric berhasil direset sesuai format Foto 1 & 2!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-sm cursor-pointer"
                    title="Reset tampilan Tabel 19 sesuai format asli NeutraDC pada foto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Format Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const current = updated.progressPmTable19 ? [...updated.progressPmTable19] : [];
                      const nextNo = `${current.length + 1}.`;
                      current.push({
                        no: nextNo,
                        activity: 'Equipment Baru',
                        unit: 1,
                        planStart: `01 ${reportData.monthNameEn || 'July'}`,
                        planFinish: `05 ${reportData.monthNameEn || 'July'}`,
                        actualStart: `01 ${reportData.monthNameEn || 'July'}`,
                        actualFinish: `05 ${reportData.monthNameEn || 'July'}`,
                        actualUnit: 1,
                        pctFinish: '100%',
                        remark: ''
                      });
                      updated.progressPmTable19 = current;
                      setReportData(updated);
                      toast.success('Aktivitas PM berhasil ditambahkan');
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah PM</span>
                  </button>
                </div>
              </div>
              
              <p className="font-bold text-center text-slate-900 text-sm my-2">
                Table 19. KPI Metric
              </p>

              {/* 1. TABEL ATAS: Progress Preventive Maintenance [Month] [Year] */}
              <div className="overflow-x-auto border border-black shadow-sm">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    {/* Header Row 1: Title Banner */}
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th colSpan={10} className="py-2.5 px-3 text-center text-sm tracking-wide">
                        Progress Preventive Maintenance {reportData.monthNameEn || 'July'} {reportData.year || 2026}
                      </th>
                      <th className="w-8 print:hidden"></th>
                    </tr>
                    {/* Header Row 2 & 3: Columns with Sub-headers Plan & Actual */}
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-10">No</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-black min-w-[160px]">Activity</th>
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-14">Unit</th>
                      <th colSpan={2} className="py-1 px-2 border-r border-black border-b border-black">Plan</th>
                      <th colSpan={3} className="py-1 px-2 border-r border-black border-b border-black">Actual</th>
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-20">%Finish</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-black min-w-[200px]">Remark</th>
                      <th rowSpan={2} className="w-8 print:hidden"></th>
                    </tr>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Start</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Finish</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Start</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Finish</th>
                      <th className="py-1 px-2 border-r border-black w-14 font-medium text-[11px]">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.progressPmTable19 || []).map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 group">
                        <td className="py-1.5 px-2 text-center font-medium border-r border-black">
                          <input
                            type="text"
                            value={row.no}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].no = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black font-medium">
                          <input
                            type="text"
                            value={row.activity}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].activity = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                const val = Number(e.target.value) || 0;
                                updated.progressPmTable19[idx].unit = val;
                                const act = Number(updated.progressPmTable19[idx].actualUnit) || 0;
                                if (val > 0) {
                                  updated.progressPmTable19[idx].pctFinish = `${((act / val) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.planStart}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].planStart = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.planFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].planFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actualStart}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].actualStart = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actualFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].actualFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black font-semibold">
                          <input
                            type="text"
                            value={row.actualUnit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                const act = Number(e.target.value) || 0;
                                updated.progressPmTable19[idx].actualUnit = act;
                                const u = Number(updated.progressPmTable19[idx].unit) || 0;
                                if (u > 0) {
                                  updated.progressPmTable19[idx].pctFinish = `${((act / u) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black font-bold text-blue-900">
                          <input
                            type="text"
                            value={row.pctFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].pctFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-bold text-blue-900"
                          />
                        </td>
                        <td className="py-1 px-1.5 border-r border-black">
                          <textarea
                            rows={row.remark?.includes('\n') || (row.remark?.length || 0) > 40 ? 2 : 1}
                            value={row.remark}
                            placeholder="Catatan / kendala..."
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].remark = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none leading-tight"
                          />
                        </td>
                        <td className="py-1 px-1 print:hidden text-center">
                          <button
                            type="button"
                            title="Hapus baris PM"
                            onClick={() => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19.splice(idx, 1);
                                setReportData(updated);
                                toast.info('Baris PM berhasil dihapus');
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row: Avarage */}
                    <tr className="bg-[#0066B3] text-white font-bold border-t border-black">
                      <td colSpan={8} className="py-2.5 px-4 text-center border-r border-black text-sm tracking-wider">
                        Avarage
                      </td>
                      <td className="py-1 px-2 text-center border-r border-black">
                        <input
                          type="text"
                          value={reportData.progressPmAverage || reportData.kpiSummary?.progressPmAverage || '97,44%'}
                          onChange={(e) => {
                            const updated = { ...reportData };
                            updated.progressPmAverage = e.target.value;
                            if (updated.kpiSummary) {
                              updated.kpiSummary.progressPmAverage = e.target.value;
                            }
                            setReportData(updated);
                          }}
                          className="w-20 text-center font-bold text-sm py-1 text-white bg-transparent hover:bg-blue-700 focus:bg-blue-700 rounded outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 bg-[#0066B3]"></td>
                      <td className="print:hidden bg-[#0066B3]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. TABEL BAWAH: SLA Tiket / Order Fulfillment */}
              <div className="overflow-x-auto border border-black shadow-sm mt-6">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th className="py-2 px-2 border-r border-black w-10">No</th>
                      <th className="py-2 px-4 border-r border-black text-left min-w-[140px]">Activity</th>
                      <th className="py-2 px-3 border-r border-black w-20">Unit</th>
                      <th className="py-2 px-3 border-r border-black w-20">Actual</th>
                      <th className="py-2 px-3 border-r border-black w-20">Finish</th>
                      <th className="py-2 px-3 border-r border-black w-24">%Finish</th>
                      <th className="py-2 px-3 border-r border-black w-20">Comply</th>
                      <th className="py-2 px-3 text-center w-24">%Comply</th>
                      <th className="w-8 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.slaOrdersTable19 || [
                      { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
                      { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                      { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                      { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
                    ]).map((row, sIdx) => (
                      <tr key={sIdx} className="hover:bg-blue-50/20 group">
                        <td className="py-1.5 px-2 text-center font-medium border-r border-black">
                          <input
                            type="text"
                            value={row.no}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].no = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-4 border-r border-black font-semibold text-slate-900">
                          <input
                            type="text"
                            value={row.activity}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].activity = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].unit = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actual}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                const act = Number(e.target.value) || 0;
                                updated.slaOrdersTable19[sIdx].actual = act;
                                const fin = Number(updated.slaOrdersTable19[sIdx].finish) || 0;
                                if (act > 0) {
                                  updated.slaOrdersTable19[sIdx].pctFinish = `${((fin / act) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-medium"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.finish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                const fin = Number(e.target.value) || 0;
                                updated.slaOrdersTable19[sIdx].finish = fin;
                                const act = Number(updated.slaOrdersTable19[sIdx].actual) || 0;
                                if (act > 0) {
                                  updated.slaOrdersTable19[sIdx].pctFinish = `${((fin / act) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-medium"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black font-semibold">
                          <input
                            type="text"
                            value={row.pctFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].pctFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-semibold text-slate-800"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black font-bold">
                          <input
                            type="text"
                            value={row.comply}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].comply = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className={`w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-bold ${
                              row.comply === 'TM' ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-blue-900">
                          <input
                            type="text"
                            value={row.pctComply}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].pctComply = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-bold text-blue-900"
                          />
                        </td>
                        <td className="py-1 px-1 print:hidden text-center">
                          <button
                            type="button"
                            title="Hapus baris SLA"
                            onClick={() => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19.splice(sIdx, 1);
                                setReportData(updated);
                                toast.info('Baris SLA berhasil dihapus');
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row: Total Fulfillment */}
                    <tr className="bg-[#0066B3] text-white font-bold border-t border-black">
                      <td colSpan={7} className="py-2.5 px-4 text-center border-r border-black text-sm tracking-wide">
                        Total Percentage Of Performance Fulfillment Period 1
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="text"
                          value={reportData.slaOrdersPeriodTotal || '%'}
                          onChange={(e) => {
                            const updated = { ...reportData };
                            updated.slaOrdersPeriodTotal = e.target.value;
                            setReportData(updated);
                          }}
                          className="w-16 text-center font-bold text-sm py-1 text-white bg-transparent hover:bg-blue-700 focus:bg-blue-700 rounded outline-none"
                        />
                      </td>
                      <td className="print:hidden bg-[#0066B3]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. MATRIKS SERVICE CREDIT (FOTO 2) */}
              <div className="max-w-md mx-auto border border-black overflow-hidden text-xs mt-8 shadow-sm">
                <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 border-b border-black print:hidden">
                  <span className="text-[11px] font-semibold text-slate-600">Matriks Service Credit (Sesuai Foto 2)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const matrix = updated.serviceCreditMatrix ? [...updated.serviceCreditMatrix] : [
                        { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                        { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                        { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                        { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                        { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                        { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                      ];
                      matrix.push({ range: 'Baru', credit: '0%', highlighted: false, isTermination: false });
                      updated.serviceCreditMatrix = matrix;
                      setReportData(updated);
                      toast.success('Tier matriks berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tier</span>
                  </button>
                </div>
                <table className="w-full text-center border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-4 border-r border-black w-1/2 text-sm">Nilai Total  Kinerja %</th>
                      <th className="py-2.5 px-4 w-1/2 text-sm">Percentage of Service Credit</th>
                      <th className="py-2 px-1 w-8 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.serviceCreditMatrix || [
                      { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                      { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                      { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                      { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                      { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                      { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                    ]).map((row, rIdx) => {
                      const isTerm = row.isTermination || row.range.includes('<80') || row.credit?.toLowerCase().includes('terminated');
                      const isHighlighted = row.highlighted && !isTerm;
                      return (
                        <tr
                          key={rIdx}
                          className={`group transition-colors ${
                            isTerm ? 'bg-[#FFFF00] font-bold text-black' : isHighlighted ? 'bg-yellow-200 font-bold' : 'hover:bg-blue-50/20'
                          }`}
                        >
                          <td className="py-1.5 px-3 border-r border-black">
                            <input
                              type="text"
                              value={row.range}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                const matrix = [...(updated.serviceCreditMatrix || [])];
                                matrix[rIdx].range = e.target.value;
                                updated.serviceCreditMatrix = matrix;
                                setReportData(updated);
                              }}
                              className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-inherit"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={row.credit}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                const matrix = [...(updated.serviceCreditMatrix || [])];
                                matrix[rIdx].credit = e.target.value;
                                updated.serviceCreditMatrix = matrix;
                                setReportData(updated);
                              }}
                              className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-inherit"
                            />
                          </td>
                          <td className="py-1 px-1 print:hidden text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                title="Toggle Sorotan"
                                onClick={() => {
                                  const updated = { ...reportData };
                                  const matrix = [...(updated.serviceCreditMatrix || [])];
                                  matrix[rIdx].highlighted = !matrix[rIdx].highlighted;
                                  updated.serviceCreditMatrix = matrix;
                                  setReportData(updated);
                                }}
                                className={`px-1 py-0.5 text-xs rounded cursor-pointer ${
                                  row.highlighted ? 'text-amber-700 font-bold' : 'text-slate-400 hover:text-amber-600'
                                }`}
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                title="Hapus Tier"
                                onClick={() => {
                                  const updated = { ...reportData };
                                  const matrix = [...(updated.serviceCreditMatrix || [])];
                                  matrix.splice(rIdx, 1);
                                  updated.serviceCreditMatrix = matrix;
                                  setReportData(updated);
                                  toast.info('Tier berhasil dihapus');
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">5. Equipment and System Details</h2>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.equipmentDetailsTable20.length + 1;
                    updated.equipmentDetailsTable20.push({
                      no: newNo,
                      system: 'General Facility System',
                      className: 'New Facility Asset',
                      modelSN: '-',
                      manufacture: 'OEM Certified',
                      installDate: '2021',
                      location: 'Campus Area',
                      lastMaintenanceDate: '',
                      currentOperationalDate: '',
                      statusBeforeMaintenance: 'Good Condition'
                    });
                    setReportData(updated);
                    toast.success('Equipment baru berhasil ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Equipment</span>
                </button>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                Rincian aset peralatan dan spesifikasi teknis fasilitas Data Center NeutraDC Cikarang yang tercatat pada Master Asset BOQ beserta riwayat pemeliharaan berkala terakhir dan jam operasionalnya:
              </p>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 20. Equipment and System Details
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-2 text-center border-r border-black w-8">No</th>
                      <th className="py-2.5 px-2 border-r border-black w-32">Class Name</th>
                      <th className="py-2.5 px-2 border-r border-black w-24">Model/SN</th>
                      <th className="py-2.5 px-2 border-r border-black w-24">Manufacture</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-16">Install Date</th>
                      <th className="py-2.5 px-2 border-r border-black w-28">Location</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Last Maintenance Date</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Current Operational Hours</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Status Before Maintenance</th>
                      <th className="py-2.5 px-1 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.equipmentDetailsTable20.slice(0, 45).map((eq, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-1 text-center font-bold border-r border-black">{eq.no}</td>
                        <td className="py-1 px-1 border-r border-black font-bold">
                          <input
                            type="text"
                            value={eq.className}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].className = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-1 font-mono text-[11px] border-r border-black">
                          <input
                            type="text"
                            value={eq.modelSN}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].modelSN = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-[11px] font-mono py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-1 border-r border-black">
                          <input
                            type="text"
                            value={eq.manufacture}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].manufacture = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <input
                            type="text"
                            value={eq.installDate}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].installDate = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-1 border-r border-black">
                          <input
                            type="text"
                            value={eq.location}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].location = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <input
                            type="text"
                            value={eq.lastMaintenanceDate}
                            placeholder="Tgl PM..."
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].lastMaintenanceDate = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-slate-300"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <input
                            type="text"
                            value={eq.currentOperationalDate}
                            placeholder="misal 2.040 Hours"
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].currentOperationalDate = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-slate-300 font-medium"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <BilingualTextarea
                            value={eq.statusBeforeMaintenance}
                            placeholderEn="Good Condition"
                            placeholderId="Kondisi Baik (garis miring)..."
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20[idx].statusBeforeMaintenance = val;
                              setReportData(updated);
                            }}
                            classNameEn="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            classNameId="w-full text-center text-[10.5px] italic text-slate-500 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            indentId={false}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.equipmentDetailsTable20.splice(idx, 1);
                              updated.equipmentDetailsTable20.forEach((item, i) => { item.no = i + 1; });
                              setReportData(updated);
                              toast.info('Equipment dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 21: System Overview */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-sm">
                    Table 21. System Overview
                  </p>
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const newNo = updated.systemOverviewTable21.length + 1;
                      updated.systemOverviewTable21.push({
                        no: newNo,
                        component: 'Komponen Baru',
                        functionDesc: 'Deskripsi fungsi dan pentingnya pemeliharaan.'
                      });
                      setReportData(updated);
                      toast.success('Komponen baru ditambahkan ke Tabel 21!');
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Komponen</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-black">
                  <table className="w-full text-left text-xs border-collapse font-serif">
                    <thead>
                      <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                        <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                        <th className="py-2.5 px-3 w-48 border-r border-black">Component / System</th>
                        <th className="py-2.5 px-3 border-r border-black">Function & Maintenance Importance</th>
                        <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-slate-800">
                      {reportData.systemOverviewTable21.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20">
                          <td className="py-2.5 px-3 text-center font-bold border-r border-black">{item.no}</td>
                          <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                            <input
                              type="text"
                              value={item.component}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.systemOverviewTable21[idx].component = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 leading-relaxed border-r border-black">
                            <BilingualTextarea
                              value={item.functionDesc}
                              placeholderEn="Function & Maintenance Importance..."
                              placeholderId="Fungsi dan pentingnya pemeliharaan (garis miring)..."
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.systemOverviewTable21[idx].functionDesc = val;
                                setReportData(updated);
                              }}
                              classNameEn="w-full text-xs text-slate-800 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              indentId={true}
                            />
                          </td>
                          <td className="py-1 px-1 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                updated.systemOverviewTable21.splice(idx, 1);
                                updated.systemOverviewTable21.forEach((it, i) => { it.no = i + 1; });
                                setReportData(updated);
                                toast.info('Komponen dihapus.');
                              }}
                              className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                            </button>
                          </td>
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

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">6. Scope of Work</h2>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const schedScopes: string[] = (updated.scheduleTable1 || []).map((s: any) => s.device);
                      updated.scopeOfWorkTable22 = schedScopes.map((scope: string) => getScopeOfWorkForScope(scope));
                      updated._sowDetailedVersion = 3;
                      setReportData(updated);
                      toast.success('Scope of Work berhasil di-reset ke SOP Teknis Standard SR Bilingual (EN / ID)!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shadow-xs"
                    title="Muat ulang seluruh lingkup Bab 6 dengan SOP naratif teknis lengkap beserta parameter pengukuran Service Report"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset ke SOP Standard SR</span>
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      updated.scopeOfWorkTable22.push({
                        category: 'KATEGORI SOP BARU',
                        items: [
                          {
                            step: '1. Tahap Persiapan & Pemeriksaan Awal',
                            tasks: ['Pengecekan visual dan parameter awal.', 'Pembersihan unit dan filter.']
                          }
                        ]
                      });
                      setReportData(updated);
                      toast.success('Kategori Scope of Work baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kategori SOP</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                Rangkaian tahapan prosedur operasional standar (SOP) Preventive Maintenance yang dijalankan oleh tim teknisi DME pada setiap perangkat:
              </p>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 22. Scope of Work
              </p>

              <div className="space-y-6">
                {reportData.scopeOfWorkTable22.map((sow, sIdx) => (
                  <div key={sIdx} className="border border-black overflow-hidden text-xs rounded-lg">
                    <div className="bg-[#0066B3] text-white p-2.5 font-bold text-sm flex items-center justify-between">
                      <input
                        type="text"
                        value={sow.category}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.scopeOfWorkTable22[sIdx].category = e.target.value;
                          setReportData(updated);
                        }}
                        className="font-bold text-white bg-transparent hover:bg-white/20 focus:bg-white/20 rounded px-1 outline-none w-3/4"
                      />
                      <div className="flex items-center gap-2 print:hidden">
                        <button
                          onClick={() => {
                            const updated = { ...reportData };
                            const newStepNo = updated.scopeOfWorkTable22[sIdx].items.length + 1;
                            updated.scopeOfWorkTable22[sIdx].items.push({
                              step: `${newStepNo}. Tahap Pemeliharaan Tambahan`,
                              tasks: ['Pengecekan parameter operasional.']
                            });
                            setReportData(updated);
                            toast.success('Tahapan baru ditambahkan!');
                          }}
                          className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-sans cursor-pointer"
                        >
                          + Step
                        </button>
                        <button
                          onClick={() => {
                            const updated = { ...reportData };
                            updated.scopeOfWorkTable22.splice(sIdx, 1);
                            setReportData(updated);
                            toast.info('Kategori SOP dihapus.');
                          }}
                          className="p-1 hover:text-red-200 transition-colors cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/80 hover:text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-black">
                      {sow.items.map((step, stIdx) => (
                        <div key={stIdx} className="p-3 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <BilingualTextarea
                              value={step.step}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.scopeOfWorkTable22[sIdx].items[stIdx].step = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Step Title in English..."
                              placeholderId="Judul Tahapan Bahasa Indonesia (garis miring)..."
                              classNameEn="font-bold text-slate-900 text-xs bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none w-full leading-tight font-serif"
                              classNameId="font-semibold italic text-blue-800 text-[11.5px] bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none w-full leading-tight font-serif"
                              containerClassName="w-3/4 flex flex-col space-y-0.5"
                              indentId={true}
                            />
                            <div className="flex items-center gap-2 print:hidden">
                              <button
                                onClick={() => {
                                  const updated = { ...reportData };
                                  updated.scopeOfWorkTable22[sIdx].items[stIdx].tasks.push('Perform technical inspection on system.\nLakukan inspeksi teknis pada sistem.');
                                  setReportData(updated);
                                }}
                                className="text-[10px] text-blue-600 hover:underline font-sans cursor-pointer"
                              >
                                + Task
                              </button>
                              <button
                                onClick={() => {
                                  const updated = { ...reportData };
                                  updated.scopeOfWorkTable22[sIdx].items.splice(stIdx, 1);
                                  setReportData(updated);
                                }}
                                className="p-0.5 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5 pl-4">
                            {step.tasks.map((task, tIdx) => (
                              <div key={tIdx} className="flex items-start gap-2 group">
                                <span className="text-blue-500 mt-0.5 select-none font-bold text-sm leading-none">•</span>
                                <BilingualTextarea
                                  value={task}
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.scopeOfWorkTable22[sIdx].items[stIdx].tasks[tIdx] = val;
                                    setReportData(updated);
                                  }}
                                  placeholderEn="English Technical SOP..."
                                  placeholderId="Instruksi Teknis Bahasa Indonesia (garis miring)..."
                                  classNameEn="w-full text-xs text-slate-800 leading-snug py-0.5 px-1.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans"
                                  classNameId="w-full text-[11.5px] italic text-slate-600 leading-snug py-0.5 px-1.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                                <button
                                  onClick={() => {
                                    const updated = { ...reportData };
                                    updated.scopeOfWorkTable22[sIdx].items[stIdx].tasks.splice(tIdx, 1);
                                    setReportData(updated);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden self-start mt-1"
                                >
                                  <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                                </button>
                              </div>
                            ))}
                          </div>
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

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">7. Observation and Finding</h2>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.observationTable23.push({
                      scope: 'LINGKUP PERALATAN BARU',
                      items: [
                        {
                          no: 1,
                          component: 'Komponen Baru',
                          conditionBefore: 'Normal / Bersih',
                          inspectionNotes: 'Tidak ada anomali atau deviasi operasional.'
                        }
                      ]
                    });
                    setReportData(updated);
                    toast.success('Lingkup temuan baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Lingkup Temuan</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 23. Observation & Finding
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black w-48">Component</th>
                      <th className="py-2.5 px-3 border-r border-black">Condition Before</th>
                      <th className="py-2.5 px-3 border-r border-black">Inspection Notes</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.observationTable23.map((sec, sIdx) => (
                      <React.Fragment key={`sec-${sIdx}`}>
                        <tr className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-1.5 px-2">
                            <input
                              type="text"
                              value={sec.scope}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.observationTable23[sIdx].scope = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full font-bold text-slate-900 bg-transparent hover:bg-white/40 focus:bg-white/60 rounded px-1 outline-none text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                const newNo = updated.observationTable23[sIdx].items.length + 1;
                                updated.observationTable23[sIdx].items.push({
                                  no: newNo,
                                  component: 'Komponen Baru',
                                  conditionBefore: 'Normal',
                                  inspectionNotes: 'Tidak ada anomali.'
                                });
                                setReportData(updated);
                                toast.success('Baris temuan ditambahkan!');
                              }}
                              className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-sans cursor-pointer whitespace-nowrap"
                            >
                              + Baris
                            </button>
                          </td>
                        </tr>
                        {sec.items.map((item, iIdx) => (
                          <tr key={`item-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                            <td className="py-1 px-2 border-r border-black font-bold">
                              <input
                                type="text"
                                value={item.component}
                                onChange={(e) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].component = e.target.value;
                                  setReportData(updated);
                                }}
                                className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.conditionBefore}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].conditionBefore = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Condition before (EN)..."
                                placeholderId="Kondisi awal (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.inspectionNotes}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].inspectionNotes = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Inspection notes (EN)..."
                                placeholderId="Catatan inspeksi (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-1 text-center print:hidden">
                              <button
                                onClick={() => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items.splice(iIdx, 1);
                                  updated.observationTable23[sIdx].items.forEach((it, idx) => { it.no = idx + 1; });
                                  setReportData(updated);
                                  toast.info('Baris temuan dihapus.');
                                }}
                                className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Root Cause Analyses Section */}
              <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Root Cause Analysis</h3>
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      updated.rootCauseAnalyses.push({
                        title: 'Analisis Root Cause Baru',
                        system: 'General Facility System',
                        description: 'Jelaskan kronologi, faktor penyebab utama, serta dampaknya terhadap sistem.',
                        photos: []
                      });
                      setReportData(updated);
                      toast.success('RCA baru berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Root Cause</span>
                  </button>
                </div>

                {reportData.rootCauseAnalyses.map((rca, rIdx) => (
                  <div key={rIdx} className="p-4 border border-black rounded-xl space-y-3 bg-slate-50/40">
                    <div className="flex items-center justify-between">
                      <textarea
                        rows={rca.title?.includes('\n') ? 2 : 1}
                        value={rca.title}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.rootCauseAnalyses[rIdx].title = e.target.value;
                          setReportData(updated);
                        }}
                        className="text-sm font-bold text-blue-950 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none w-3/4 resize-none leading-tight font-serif whitespace-pre-line"
                      />
                      <button
                        onClick={() => {
                          const updated = { ...reportData };
                          updated.rootCauseAnalyses.splice(rIdx, 1);
                          setReportData(updated);
                          toast.info('RCA dihapus.');
                        }}
                        className="p-1 hover:text-red-600 transition-colors cursor-pointer print:hidden"
                        title="Hapus RCA"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                    <textarea
                      value={rca.description}
                      rows={3}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.rootCauseAnalyses[rIdx].description = e.target.value;
                        setReportData(updated);
                      }}
                      className="w-full text-xs text-slate-700 p-2 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-y"
                    />
                    {rca.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {rca.photos.map((ph, pIdx) => (
                          <div key={pIdx} className="border border-black rounded-xl overflow-hidden text-center bg-white shadow-xs">
                            <img src={ph.url} alt={ph.caption} className="w-full h-28 object-cover" />
                            <p className="text-[10px] p-1.5 font-bold text-slate-700">{ph.caption}</p>
                          </div>
                        ))}
                      </div>
                    )}
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

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">8. Repairs, Replacement & Services</h2>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Data suku cadang ditarik 100% dari Laporan Corrective Maintenance (CM) Standby Engineer bulan ini.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.repairsTable29.push({
                      equipment: 'Equipment Baru',
                      partName: 'Part Komponen',
                      partNumber: '-',
                      quantity: '1 Pcs',
                      replacedStatus: 'Replaced'
                    });
                    setReportData(updated);
                    toast.success('Baris baru berhasil ditambahkan ke Tabel 29!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 29. Repair, Replacement & Services
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 border-r border-black">Equipment</th>
                      <th className="py-2.5 px-3 border-r border-black">Part Name</th>
                      <th className="py-2.5 px-3 border-r border-black">Part Number</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Quantity</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Status</th>
                      <th className="py-2.5 px-2 text-center w-10 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.repairsTable29.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 italic font-sans text-xs bg-slate-50/50">
                          Tidak ada data pergantian suku cadang (spare part replacement) pada periode bulan ini.
                        </td>
                      </tr>
                    ) : (
                      reportData.repairsTable29.map((r, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20">
                          <td className="py-1 px-2 font-bold border-r border-black">
                            <input
                              type="text"
                              value={r.equipment}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].equipment = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-bold"
                            />
                          </td>
                          <td className="py-1 px-2 border-r border-black">
                            <BilingualTextarea
                              value={r.partName}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].partName = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Part name (EN)..."
                              placeholderId="Nama komponen (ID - garis miring)..."
                              classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              indentId={true}
                            />
                          </td>
                          <td className="py-1 px-2 border-r border-black font-mono text-[11px]">
                            <input
                              type="text"
                              value={r.partNumber}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].partNumber = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-[11px] font-mono py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 text-center border-r border-black">
                            <input
                              type="text"
                              value={r.quantity}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].quantity = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 text-center border-r border-black font-semibold">
                            <BilingualTextarea
                              value={r.replacedStatus}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].replacedStatus = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Status (EN)..."
                              placeholderId="Status (ID - garis miring)..."
                              classNameEn="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold font-serif"
                              classNameId="w-full text-center text-[10px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              indentId={false}
                            />
                          </td>
                          <td className="py-1 px-2 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                updated.repairsTable29.splice(idx, 1);
                                setReportData(updated);
                                toast.info('Baris perbaikan dihapus.');
                              }}
                              className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 9: TESTING & VALIDATION (TABEL 30 & TABEL 31)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 9 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">9. Testing & Validation</h2>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const newNo = updated.calibrationTable30.length + 1;
                      updated.calibrationTable30.push({
                        no: newNo,
                        component: 'Komponen Baru',
                        calibrationDetail: 'Zero offset & sensitivity calibration.'
                      });
                      setReportData(updated);
                      toast.success('Baris kalibrasi baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kalibrasi</span>
                  </button>
                  <button
                    onClick={handleAITesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Generate Metode Uji</span>
                  </button>
                </div>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 30. Calibration and Adjustments Performed
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Calibration Performed</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.calibrationTable30.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.calibrationTable30[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.calibrationDetail}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.calibrationTable30[idx].calibrationDetail = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Calibration detail (EN)..."
                            placeholderId="Detail kalibrasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.calibrationTable30.splice(idx, 1);
                              updated.calibrationTable30.forEach((it, i) => { it.no = i + 1; });
                              setReportData(updated);
                              toast.info('Baris kalibrasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-center text-slate-900 text-sm">
                  Table 31. Validation Methods
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.validationMethodsTable31.length + 1;
                    updated.validationMethodsTable31.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      validationMethod: 'Functional step-by-step test & simulation.'
                    });
                    setReportData(updated);
                    toast.success('Baris validasi baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Validasi</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Validation Methods</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.validationMethodsTable31.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.validationMethodsTable31[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.validationMethod}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.validationMethodsTable31[idx].validationMethod = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Validation method (EN)..."
                            placeholderId="Metode validasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.validationMethodsTable31.splice(idx, 1);
                              updated.validationMethodsTable31.forEach((it, i) => { it.no = i + 1; });
                              setReportData(updated);
                              toast.info('Baris validasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 10: CHALLENGES, MITIGATION & LESSON LEARNED (TABEL 32 - 34)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 10 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">10. Challenges, Mitigation and Lesson Learned</h2>
                <button
                  onClick={handleAIChallenges}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer print:hidden"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI Susun Tantangan & Mitigasi</span>
                </button>
              </div>

              {/* Table 32: Challenges */}
              <div className="flex items-center justify-between my-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 32. Challenges Faced
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.challengesTable32.length + 1;
                    updated.challengesTable32.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      challenge: 'Deskripsi kendala teknis / operasional yang dihadapi.'
                    });
                    setReportData(updated);
                    toast.success('Tantangan baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Tantangan</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Challenges Faced</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.challengesTable32.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.challengesTable32[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.challenge}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.challengesTable32[idx].challenge = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Challenges faced (EN)..."
                            placeholderId="Kendala yang dihadapi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.challengesTable32.splice(idx, 1);
                              updated.challengesTable32.forEach((it, i) => { it.no = i + 1; });
                              setReportData(updated);
                              toast.info('Tantangan dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 33: Mitigation */}
              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 33. Mitigation Steps
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.mitigationTable33.length + 1;
                    updated.mitigationTable33.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      mitigation: 'Langkah mitigasi operasional dan koordinasi.'
                    });
                    setReportData(updated);
                    toast.success('Mitigasi baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Mitigasi</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Mitigation</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.mitigationTable33.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.mitigationTable33[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.mitigation}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.mitigationTable33[idx].mitigation = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Mitigation steps (EN)..."
                            placeholderId="Langkah mitigasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.mitigationTable33.splice(idx, 1);
                              updated.mitigationTable33.forEach((it, i) => { it.no = i + 1; });
                              setReportData(updated);
                              toast.info('Mitigasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 34: Lessons Learned */}
              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 34. Lessons Learned
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.lessonsLearnedTable34.length + 1;
                    updated.lessonsLearnedTable34.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      lessonLearned: 'Pelajaran penting untuk peningkatan SOP mendatang.'
                    });
                    setReportData(updated);
                    toast.success('Lesson learned baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Lesson Learned</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Lesson Learned</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.lessonsLearnedTable34.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.lessonsLearnedTable34[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.lessonLearned}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.lessonsLearnedTable34[idx].lessonLearned = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Lesson learned (EN)..."
                            placeholderId="Pelajaran yang dipetik (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.lessonsLearnedTable34.splice(idx, 1);
                              updated.lessonsLearnedTable34.forEach((it, i) => { it.no = i + 1; });
                              setReportData(updated);
                              toast.info('Lesson learned dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
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

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">11. Recommendations and Future Action</h2>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Dihubungkan langsung dari temuan anomali Bab 7 ke rekomendasi Short-Term dan Long-Term.
                  </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      updated.recommendationsTable35.push({
                        scope: 'LINGKUP PERALATAN BARU',
                        items: [
                          {
                            no: 1,
                            component: 'Komponen Baru',
                            shortTerm: 'Rekomendasi jangka pendek.',
                            longTerm: 'Rekomendasi jangka panjang.'
                          }
                        ]
                      });
                      setReportData(updated);
                      toast.success('Lingkup rekomendasi baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Lingkup Rekomendasi</span>
                  </button>
                  <button
                    onClick={handleAIRecs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Rekomendasi dari Bab 7</span>
                  </button>
                </div>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 35. Recommendations and Future Action
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black w-48">Component</th>
                      <th className="py-2.5 px-3 border-r border-black">Short-Term Recommendations</th>
                      <th className="py-2.5 px-3 border-r border-black">Long-Term Recommendations</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.recommendationsTable35.map((rSec, sIdx) => (
                      <React.Fragment key={`rsec-${sIdx}`}>
                        <tr className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-1.5 px-2">
                            <input
                              type="text"
                              value={rSec.scope}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.recommendationsTable35[sIdx].scope = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full font-bold text-slate-900 bg-transparent hover:bg-white/40 focus:bg-white/60 rounded px-1 outline-none text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                const newNo = updated.recommendationsTable35[sIdx].items.length + 1;
                                updated.recommendationsTable35[sIdx].items.push({
                                  no: newNo,
                                  component: 'Komponen Baru',
                                  shortTerm: 'Tindakan jangka pendek.',
                                  longTerm: 'Tindakan jangka panjang.'
                                });
                                setReportData(updated);
                                toast.success('Baris rekomendasi ditambahkan!');
                              }}
                              className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-sans cursor-pointer whitespace-nowrap"
                            >
                              + Baris
                            </button>
                          </td>
                        </tr>
                        {rSec.items.map((item, iIdx) => (
                          <tr key={`ritem-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                            <td className="py-1 px-2 border-r border-black font-bold">
                              <input
                                type="text"
                                value={item.component}
                                onChange={(e) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].component = e.target.value;
                                  setReportData(updated);
                                }}
                                className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.shortTerm}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].shortTerm = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Short-term recommendation (EN)..."
                                placeholderId="Rekomendasi jangka pendek (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.longTerm}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].longTerm = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Long-term recommendation (EN)..."
                                placeholderId="Rekomendasi jangka panjang (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-1 text-center print:hidden">
                              <button
                                onClick={() => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items.splice(iIdx, 1);
                                  updated.recommendationsTable35[sIdx].items.forEach((it, idx) => { it.no = idx + 1; });
                                  setReportData(updated);
                                  toast.info('Baris rekomendasi dihapus.');
                                }}
                                className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 12: PHOTO AND DOCUMENTATION LOG (TABEL 36)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 12 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">12. Photo and Documentation Log</h2>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...reportData };
                    const nextNo = updated.photoLogsTable36.length + 1;
                    updated.photoLogsTable36.push({
                      no: nextNo,
                      component: 'Equipment / Area Dokumentasi',
                      prePhoto: '',
                      duringPhoto: '',
                      postPhoto: '',
                      caption: ''
                    });
                    setReportData(updated);
                    toast.success('Baris dokumentasi foto baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Foto</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 36. Photo and Documentation Log
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Pre-Maintenance</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Activities</th>
                      <th className="py-2.5 px-3 text-center">Post-Maintenance</th>
                      <th className="py-2.5 px-2 w-10 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.photoLogsTable36.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 group">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-2 px-3 font-bold border-r border-black">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.photoLogsTable36[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            placeholder="Nama komponen / aktivitas"
                          />
                        </td>
                        {/* Pre-Maintenance Photo Cell */}
                        <td className="py-2 px-3 text-center border-r border-black align-middle">
                          {item.prePhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.prePhoto}
                                  alt="Pre-Maintenance"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Pre-Maintenance';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'prePhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'prePhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'prePhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Foto Terlampir / Normal ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'prePhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].prePhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].prePhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Activities Photo Cell */}
                        <td className="py-2 px-3 text-center border-r border-black align-middle">
                          {item.duringPhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.duringPhoto}
                                  alt="Activities"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Activities';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'duringPhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'duringPhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'duringPhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Foto Aktivitas PM ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'duringPhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].duringPhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].duringPhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Post-Maintenance Photo Cell */}
                        <td className="py-2 px-3 text-center align-middle">
                          {item.postPhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.postPhoto}
                                  alt="Post-Maintenance"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Post-Maintenance';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'postPhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'postPhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'postPhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Verifikasi Selesai ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'postPhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].postPhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].postPhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...reportData };
                              updated.photoLogsTable36.splice(idx, 1);
                              updated.photoLogsTable36.forEach((p, pIdx) => { p.no = pIdx + 1; });
                              setReportData(updated);
                              toast.info('Baris dokumentasi foto dihapus');
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Hapus baris foto"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
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
              <textarea
                rows={3}
                value={reportData.appendicesNote !== undefined ? reportData.appendicesNote : 'Attach the original service report & supporting documents for certification, test results, etc.'}
                onChange={(e) => {
                  const updated = { ...reportData };
                  updated.appendicesNote = e.target.value;
                  setReportData(updated);
                }}
                className="w-full text-sm text-slate-600 italic leading-relaxed p-2.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded border border-transparent hover:border-black outline-none resize-y"
                placeholder="Catatan dokumen lampiran laporan..."
              />
              <TelkomPageFooter pageNumber="Appendices" />
            </section>
          )}

        </div>
      )}


    </div>
  );
}
