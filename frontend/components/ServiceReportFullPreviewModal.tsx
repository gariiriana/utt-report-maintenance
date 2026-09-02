// ============================================================================
// FILE: frontend/components/ServiceReportFullPreviewModal.tsx
// Deskripsi: Modal Pratinjau (Preview) Lengkap Service Report Resmi (Page 1: 1:1 Spreadsheet)
//            + Lampiran Foto-Foto Dokumentasi Pekerjaan (Page 2+: Kop Formal Standar)
// ============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Download, FileText, Images, Layers } from 'lucide-react';
import { ServiceReportPayload } from '@/types/serviceReportTypes';
import { generateUniversalServiceReportPDF } from '@/service_reports/universalServiceReportPDF';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoK2 from '@/assets/logo_k2.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';

interface ServiceReportFullPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ServiceReportPayload;
  photoCards: Array<{ photoBase64?: string; description: string }>;
  companyType?: 'neutra' | 'bri' | 'k2';
  onExport?: (payload: ServiceReportPayload) => Promise<void> | void;
}

export function ServiceReportFullPreviewModal({
  isOpen,
  onClose,
  payload,
  photoCards,
  companyType = 'neutra',
  onExport
}: ServiceReportFullPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'page1' | 'page2'>('all');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
  const rightLogo = companyType === 'bri' ? logoBRI : companyType === 'k2' ? logoK2 : logoNeutraDC;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (onExport) {
        await onExport(payload);
      } else {
        await generateUniversalServiceReportPDF(payload, photoCards, true);
      }
      onClose();
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filledPhotos = photoCards.filter(p => p.photoBase64 || p.description);
  const c = payload.customerInfo || ({} as any);
  const m = payload.measurements || ({} as any);
  const op = payload.operationStatus || ({} as any);
  const t = payload.timeSpent || ({} as any);
  const isNorm = op.isNormal === true || op.isNormal === ('true' as any) || (op as any).is_normal === true;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-700/60 rounded-2xl sm:rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]"
        >
          {/* ─── STICKY HEADER ─── */}
          <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl px-4 sm:px-6 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali & Edit</span>
              </button>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                  Pratinjau Dokumen Service Report
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                  {payload.equipmentName} • {filledPhotos.length} Foto Dokumentasi Terlampir
                </p>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${activeTab === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Semua Halaman</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('page1')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${activeTab === 'page1' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hal 1: Form Resmi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('page2')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${activeTab === 'page2' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Images className="w-3.5 h-3.5" />
                <span>Hal 2+: Lampiran Foto</span>
              </button>
            </div>

            {/* EXPORT BUTTON */}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl font-black text-xs shadow-lg shadow-sky-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Mengekspor...' : 'Export Service Report & Foto (PDF)'}</span>
            </button>
          </div>

          {/* ─── SCROLLABLE DOCUMENT PREVIEW ─── */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 bg-slate-950/50 custom-scrollbar">
            {/* ══════════════════════════════════════════════════════════════════════
                HALAMAN 1: SERVICE REPORT RESMI (1:1 FORMAT SPREADSHEET)
               ══════════════════════════════════════════════════════════════════════ */}
            {(activeTab === 'all' || activeTab === 'page1') && (
              <div className="bg-white text-slate-900 p-4 sm:p-6 rounded-xl shadow-2xl border border-slate-300 w-full max-w-[850px] mx-auto font-sans text-[10px] leading-tight select-none">
                {/* 1. KOP SURAT */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                  <div className="w-24 sm:w-28 shrink-0">
                    <img src={leftLogo} alt="Logo Dwimitra" className="h-10 sm:h-12 w-auto object-contain" />
                  </div>
                  <div className="text-center flex-1 px-2">
                    <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 uppercase">
                      SERVICE REPORT AUTOMATIC TRANSFER SWITCH
                    </h1>
                    <p className="text-[10px] font-medium text-slate-700">Neutra DC Cikarang</p>
                  </div>
                  <div className="w-24 sm:w-28 shrink-0 flex justify-end">
                    <img src={rightLogo} alt="Logo Client" className="h-8 sm:h-10 w-auto object-contain" />
                  </div>
                </div>

                {/* 2. CUSTOMER TABLE */}
                <div className="mb-2 border border-slate-400 overflow-hidden">
                  <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[9.5px]">
                    Customer
                  </div>
                  <table className="w-full text-[9px] border-collapse">
                    <tbody>
                      <tr className="border-t border-slate-300">
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 w-[14%] border-r border-slate-300">Company name</td>
                        <td className="px-1.5 py-0.5 w-[20%] border-r border-slate-300">{c.companyName || 'Neutra DC Cikarang'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 w-[10%] border-r border-slate-300">Type</td>
                        <td className="px-1.5 py-0.5 w-[14%] border-r border-slate-300">{(c as any).type || c.specification || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 w-[13%] border-r border-slate-300">Spesification</td>
                        <td className="px-1.5 py-0.5 w-[15%] border-r border-slate-300">{c.specification || c.model || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 w-[10%] border-r border-slate-300">Mop No:</td>
                        <td className="px-1.5 py-0.5">{c.mopNo || '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-300">
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Equpment name</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.equipmentName || 'ATS'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Serial No:</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.serialNo || '-'}</td>
                        <td colSpan={2} className="border-r border-slate-300"></td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Quarter</td>
                        <td className="px-1.5 py-0.5">{c.quarter || 'Q3'}</td>
                      </tr>
                      <tr className="border-t border-slate-300">
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">CI Description</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.ciDescription || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Product Name</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.productName || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Location</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.location || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Date</td>
                        <td className="px-1.5 py-0.5">{c.date || new Date().toISOString().split('T')[0]}</td>
                      </tr>
                      <tr className="border-t border-slate-300">
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">CI Name</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.ciName || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Product Years</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.prodYear || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Area</td>
                        <td className="px-1.5 py-0.5 border-r border-slate-300">{c.area || '-'}</td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Engginer</td>
                        <td className="px-1.5 py-0.5">{c.engineer || payload.accountEmail || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. VISUAL INSPECTION TABLE */}
                <div className="mb-2 border border-slate-400 overflow-hidden">
                  <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[9.5px]">
                    Visual inspection & Check
                  </div>
                  <table className="w-full text-[8.5px] border-collapse">
                    <thead>
                      <tr className="bg-[#D9E2F3] text-slate-900 font-bold border-t border-b border-slate-400">
                        <th rowSpan={2} className="py-0.5 px-1 border-r border-slate-300 w-6 text-center">No</th>
                        <th rowSpan={2} className="py-0.5 px-1.5 border-r border-slate-300 text-left">Activity</th>
                        <th rowSpan={2} className="py-0.5 px-1.5 border-r border-slate-300 w-48 text-left">Parameter</th>
                        <th colSpan={2} className="py-0.5 px-1 border-r border-slate-300 text-center w-24">Condition</th>
                        <th rowSpan={2} className="py-0.5 px-1.5 w-36 text-center">Remarks</th>
                      </tr>
                      <tr className="bg-[#D9E2F3] text-slate-900 font-bold border-b border-slate-400">
                        <th className="py-0.5 px-1 border-r border-slate-300 w-12 text-center">Good</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-12 text-center">Not Good</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.visualChecklist.map((item, idx) => {
                        const isGood = item.condition === 'Good';
                        const isNotGood = item.condition === 'Not Good';
                        return (
                          <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                            <td className="py-0.5 px-1 border-r border-slate-300 text-center font-bold text-slate-700">{item.no || `${String.fromCharCode(97 + idx)}.`}</td>
                            <td className="py-0.5 px-1.5 border-r border-slate-300 text-slate-900">{item.activity}</td>
                            <td className="py-0.5 px-1.5 border-r border-slate-300 text-slate-700">{item.parameter}</td>
                            <td className="py-0.5 px-1 border-r border-slate-300 text-center">
                              <span className={isNotGood ? "line-through text-slate-400 decoration-slate-900 decoration-[1.5px]" : isGood ? "font-bold text-slate-900" : "text-slate-700"}>
                                Good
                              </span>
                            </td>
                            <td className="py-0.5 px-1 border-r border-slate-300 text-center">
                              <span className={isGood ? "line-through text-slate-400 decoration-slate-900 decoration-[1.5px]" : isNotGood ? "font-bold text-red-700" : "text-slate-700"}>
                                Not Good
                              </span>
                            </td>
                            <td className="py-0.5 px-1.5 text-slate-700 text-center">{item.remarks || ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 4. DIGITAL POWER METER RECORDING */}
                <div className="mb-2 border border-slate-400 overflow-hidden">
                  <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[9px]">
                    Digital Power Meter Recording <span className="font-normal text-[8px]">Please mark OK (√),not OK(×), not applicable (N/A) in the box</span>
                  </div>
                  <table className="w-full text-[8.5px] border-collapse text-center">
                    <thead>
                      <tr className="bg-[#D9E2F3] text-slate-900 font-bold border-t border-b border-slate-400">
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Voltage)</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Voltage)</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-12">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Ampere)</th>
                        <th className="py-0.5 px-1 text-center">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R-S</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_rs || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R-N</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_rn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">KW</td>
                        <td className="border-r border-slate-300">{m.dpm_kw || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R</td>
                        <td className="border-r border-slate-300">{m.dpm_ampere_r || '-'}</td>
                        <td rowSpan={4} className="text-center px-2 align-middle">{m.dpm_remarks || ''}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S-T</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_st || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S-N</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_sn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">KVA</td>
                        <td className="border-r border-slate-300">{m.dpm_kva || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S</td>
                        <td className="border-r border-slate-300">{m.dpm_ampere_s || '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T-R</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_tr || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T-N</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_tn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">KVAR</td>
                        <td className="border-r border-slate-300">{m.dpm_kvar || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T</td>
                        <td className="border-r border-slate-300">{m.dpm_ampere_t || '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="border-r border-slate-300"></td>
                        <td className="border-r border-slate-300"></td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">N</td>
                        <td className="border-r border-slate-300">{m.dpm_voltage_n || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">Cos p</td>
                        <td className="border-r border-slate-300">{m.dpm_cos_p || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">N</td>
                        <td className="border-r border-slate-300">{m.dpm_ampere_n || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 5. VOLTAGE & CURRENT MEASUREMENT */}
                <div className="mb-2 border border-slate-400 overflow-hidden">
                  <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[9px]">
                    Voltage & Current Measurement
                  </div>
                  <table className="w-full text-[8.5px] border-collapse text-center">
                    <thead>
                      <tr className="bg-[#D9E2F3] text-slate-900 font-bold border-t border-b border-slate-400">
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Voltage)</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Voltage)</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-10">Wire</th>
                        <th className="py-0.5 px-1 border-r border-slate-300 w-16">Result (Ampere)</th>
                        <th className="py-0.5 px-2 border-r border-slate-300 w-44">Standard</th>
                        <th className="py-0.5 px-1 text-center">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R-S</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_rs || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R-N</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_rn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">R</td>
                        <td className="border-r border-slate-300">{m.vc_ampere_r || '-'}</td>
                        <td rowSpan={4} className="bg-[#FFF2CC] text-red-700 font-bold border-r border-slate-300 text-[8px] px-1 align-middle">
                          +5% - 10% from 380V & 220V load deviation 10%
                        </td>
                        <td rowSpan={4} className="text-center px-2 align-middle">{m.vc_remarks || ''}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S-T</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_st || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S-N</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_sn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">S</td>
                        <td className="border-r border-slate-300">{m.vc_ampere_s || '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T-R</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_tr || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T-N</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_tn || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">T</td>
                        <td className="border-r border-slate-300">{m.vc_ampere_t || '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="border-r border-slate-300"></td>
                        <td className="border-r border-slate-300"></td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">N-G</td>
                        <td className="border-r border-slate-300">{m.vc_voltage_ng || '-'}</td>
                        <td className="font-bold bg-slate-50 border-r border-slate-300">N</td>
                        <td className="border-r border-slate-300">{m.vc_ampere_n || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 6. THERMAL & GROUNDING */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <div className="border border-slate-400 overflow-hidden">
                    <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[8.5px]">
                      Thermal Meassurement
                    </div>
                    <table className="w-full text-[8.5px] border-collapse text-center">
                      <thead>
                        <tr className="bg-[#D9E2F3] font-bold border-t border-b border-slate-400">
                          <th className="py-0.5 px-1 border-r border-slate-300 w-16 text-left">Breaker</th>
                          <th className="py-0.5 px-1 border-r border-slate-300 w-24">Result (°C)</th>
                          <th className="py-0.5 px-1 border-r border-slate-300 w-16">Standard</th>
                          <th className="py-0.5 px-1 text-center">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-200">
                          <td className="font-bold bg-slate-50 border-r border-slate-300 text-left px-1">Breaker</td>
                          <td className="border-r border-slate-300">{m.thermal_breaker_temp ? `${m.thermal_breaker_temp}°C` : '-'}</td>
                          <td className="bg-[#FFF2CC] font-bold border-r border-slate-300">40°C</td>
                          <td className="text-center px-1.5">{m.thermal_remarks || ''}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-slate-400 overflow-hidden">
                    <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[8.5px]">
                      Grounding Resistance Meassurement
                    </div>
                    <table className="w-full text-[8.5px] border-collapse text-center">
                      <thead>
                        <tr className="bg-[#D9E2F3] font-bold border-t border-b border-slate-400">
                          <th className="py-0.5 px-1 border-r border-slate-300 w-16 text-left">Wire</th>
                          <th className="py-0.5 px-1 border-r border-slate-300 w-24">Result (Ohm)</th>
                          <th className="py-0.5 px-1 border-r border-slate-300 w-16">Standard</th>
                          <th className="py-0.5 px-1 text-center">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-200">
                          <td className="font-bold bg-slate-50 border-r border-slate-300 text-left px-1">Grounding</td>
                          <td className="border-r border-slate-300">{m.grounding_ohm ? `${m.grounding_ohm} Ohm` : '-'}</td>
                          <td className="bg-[#FFF2CC] font-bold border-r border-slate-300">&lt;5 Ohm</td>
                          <td className="text-center px-1.5">{m.grounding_remarks || ''}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 7. OPERATION STATUS */}
                <div className="border border-slate-400 mb-2 overflow-hidden">
                  <table className="w-full text-[8.5px] border-collapse">
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold px-2 py-0.5 w-[38%] border-r border-slate-300">
                          <span className="inline-flex items-center gap-1 font-bold">
                            [{isNorm ? '✓' : '  '}] Normal operation
                          </span>
                        </td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 w-[14%] border-r border-slate-300">Remark:</td>
                        <td className="px-2 py-0.5">{op.remark || 'Unit beroperasi normal.'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="font-bold px-2 py-0.5 border-r border-slate-300">
                          <span className="inline-flex items-center gap-1 font-bold">
                            [{!isNorm ? '✓' : '  '}] Abnormal operation
                          </span>
                        </td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Fault symptom</td>
                        <td className="px-2 py-0.5">{op.faultSymptom || ''}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="italic text-[7.5px] text-slate-500 px-2 py-0.5 border-r border-slate-300">
                          (Please fill the items if the service is repair)
                        </td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Fault analysis</td>
                        <td className="px-2 py-0.5">{op.faultAnalysis || ''}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="border-r border-slate-300"></td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Work done/action taken</td>
                        <td className="px-2 py-0.5">{op.workDone || ''}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="border-r border-slate-300"></td>
                        <td className="font-bold bg-slate-50 px-1.5 py-0.5 border-r border-slate-300">Faul Part SN</td>
                        <td className="px-2 py-0.5">
                          <span>{op.faultPartSN || '-'}</span>
                          <span className="ml-6 font-bold">Fault part Name: </span>
                          <span>{op.faultPartName || '-'}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 8. TIME SPENT */}
                <div className="mb-2 border border-slate-400 overflow-hidden">
                  <div className="bg-[#8EB4E2] text-slate-900 font-bold px-2 py-0.5 text-[8.5px]">
                    TIME SPENT
                  </div>
                  <table className="w-full text-[8.5px] border-collapse text-center">
                    <thead>
                      <tr className="bg-[#D9E2F3] font-bold border-t border-b border-slate-400">
                        <th className="py-0.5 px-2 border-r border-slate-300 w-1/4">Date</th>
                        <th className="py-0.5 px-2 border-r border-slate-300 w-1/4">Departure</th>
                        <th className="py-0.5 px-2 border-r border-slate-300 w-1/4">Start</th>
                        <th className="py-0.5 px-2 w-1/4">Finish</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="py-0.5 px-2 border-r border-slate-300">{t.date || c.date || new Date().toISOString().split('T')[0]}</td>
                        <td className="py-0.5 px-2 border-r border-slate-300">{t.departure || '08:00'}</td>
                        <td className="py-0.5 px-2 border-r border-slate-300">{t.start || '09:00'}</td>
                        <td className="py-0.5 px-2">{t.finish || '17:00'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 9. SIGNATURES */}
                <div className="pt-4">
                  <div className="text-center font-bold text-[9.5px] mb-3">CUSTOMER ACKNOWLEDGEMENT:</div>
                  <div className="grid grid-cols-3 gap-4 text-center text-[8.5px]">
                    <div>
                      <div className="font-bold">Prepared</div>
                      <div className="h-10"></div>
                      <div className="font-bold border-t border-slate-400 pt-0.5">
                        Engineer<br />
                        <span className="font-normal text-slate-600">({c.engineer || payload.accountEmail || 'Engineer'})</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">Checked</div>
                      <div className="h-10"></div>
                      <div className="font-bold border-t border-slate-400 pt-0.5">
                        SM/PM<br />
                        <span className="font-normal text-slate-600">(Site Manager)</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">Approved</div>
                      <div className="h-10"></div>
                      <div className="font-bold border-t border-slate-400 pt-0.5">
                        Client / Owner<br />
                        <span className="font-normal text-slate-600">(NeutraDC)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                HALAMAN 2+: LAMPIRAN FOTO DOKUMENTASI PEKERJAAN (KOP SURAT FORMAL)
               ══════════════════════════════════════════════════════════════════════ */}
            {(activeTab === 'all' || activeTab === 'page2') && (
              <div className="bg-white text-slate-900 p-5 sm:p-7 rounded-xl shadow-2xl border border-slate-300 w-full max-w-[850px] mx-auto font-sans">
                {/* KOP SURAT FORMAL 3-KOLOM */}
                <div className="border border-slate-300 rounded-lg p-2.5 mb-5 flex items-center justify-between gap-2 bg-white">
                  <div className="w-28 shrink-0 flex items-center justify-center border-r border-slate-300 pr-2">
                    <img src={leftLogo} alt="Logo Dwimitra" className="h-10 sm:h-12 w-auto object-contain" />
                  </div>
                  <div className="text-center flex-1 px-2">
                    <h2 className="text-xs sm:text-sm font-black text-[#00599C] uppercase tracking-tight">
                      LAPORAN MAINTENANCE
                    </h2>
                    <p className="text-[10.5px] font-bold text-slate-800 uppercase">
                      DOKUMENTASI PM: {payload.equipmentName}
                    </p>
                    <p className="text-[9.5px] font-bold text-[#00599C]">
                      {c.ciName ? `${c.ciName}${c.specification ? ` - ${c.specification}` : ''}` : c.specification || payload.equipmentName}
                    </p>
                    <p className="text-[8.5px] text-slate-500 font-medium">
                      Tanggal Maintenance: {c.date || new Date().toISOString().split('T')[0]}
                    </p>
                  </div>
                  <div className="w-28 shrink-0 flex items-center justify-center border-l border-slate-300 pl-2">
                    <img src={rightLogo} alt="Logo Client" className="h-8 sm:h-10 w-auto object-contain" />
                  </div>
                </div>

                {filledPhotos.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200">
                    <Images className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">Belum ada foto dokumentasi yang diunggah.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tambahkan foto pada form kartu dokumentasi di atas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filledPhotos.map((photo, pIdx) => (
                      <div key={pIdx} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                        <div className="h-36 sm:h-40 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200">
                          {photo.photoBase64 ? (
                            <img src={photo.photoBase64} alt={`Foto ${pIdx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">Tanpa Gambar</span>
                          )}
                        </div>
                        <div className="p-2 min-h-[40px] bg-white flex items-start gap-1.5">
                          <div className="w-1 self-stretch bg-[#00599C] rounded-full shrink-0 mt-0.5"></div>
                          <p className="text-[9.5px] text-slate-800 leading-tight">
                            {photo.description || `Pemeriksaan kondisi fisik perangkat #${pIdx + 1}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* FOOTER */}
                <div className="mt-8 border-t border-slate-300 pt-2 flex items-center justify-between text-[8px] text-slate-500">
                  <div>PT DWIMITRA EKATAMA MANDIRI • DOKUMENTASI PM</div>
                  <div>Halaman 2 (Lampiran Foto)</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
