import { useState, useEffect } from 'react';
import { Eye, Wind, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { generateACSplitReportPDF } from '@/service_reports/acsplit/generateACSplitReportPDF';
import { generateACSplitReportExcel } from '@/service_reports/acsplit/generateACSplitReportExcel';
import {
  ACSplitCustomerInfo,
  ACSplitReportData,
  ACSplitTimeSpent,
  DEFAULT_ACSPLIT_CUSTOMER_INFO,
  DEFAULT_ACSPLIT_REPORT_DATA,
  DEFAULT_ACSPLIT_TIME_SPENT,
} from '@/types/acSplitReportTypes';

interface UploadedPhoto {
  id: string;
  base64: string;
  preview: string;
  category: string;
  label: string;
  parameter?: string;
}

interface ACSplitServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: ACSplitCustomerInfo; reportData: ACSplitReportData; timeSpent: ACSplitTimeSpent }) => void;
}

// ============================================================================
// FILE: frontend/components/ACSplitServiceReport.tsx
// Deskripsi: Form Pembuatan & Pemeliharaan Laporan Service AC Split Wall.
//            Mengelola data inspeksi unit indoor/outdoor, pembersihan filter/evaporator,
//            pengukuran tekanan freon (PSI), arus listrik compressor (Ampere), & analisis gangguan.
// ============================================================================

export function ACSplitServiceReport({ prefillData, onClearPrefill, onChange }: ACSplitServiceReportProps) {
  // State 1: Informasi Pelanggan & Lokasi Perangkat AC Split
  const [customerInfo, setCustomerInfo] = useState<ACSplitCustomerInfo>(DEFAULT_ACSPLIT_CUSTOMER_INFO);

  // State 2: Data Hasil Inspeksi & Pengukuran AC Split
  const [reportData, setReportData] = useState<ACSplitReportData>(DEFAULT_ACSPLIT_REPORT_DATA);

  // State 3: Data Rincian Waktu Pengerjaan
  const [timeSpent, setTimeSpent] = useState<ACSplitTimeSpent>(DEFAULT_ACSPLIT_TIME_SPENT);

  // State 4: Array Foto Lampiran Perbaikan
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // State 5: Tab Navigasi Aktif Pengisian Form
  const [activeTab, setActiveTab] = useState<'indoor' | 'outdoor' | 'testing' | 'analysis' | 'customer' | 'time' | 'photos'>('indoor');

  // State 6: Modal Zoom Preview Foto
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Effect 1: Sinkronisasi data ke komponen induk
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  // Effect 2: Memuat data dari prefill (OCR Scan / Draft Firestore)
  useEffect(() => {
    if (prefillData) {
      if (prefillData.photos) {
        const mappedPhotos: UploadedPhoto[] = prefillData.photos.map((p: any, i: number) => ({
          id: `acsplit-p-${i}-${Date.now()}`,
          base64: p.base64 || '',
          preview: p.preview || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : ''),
          category: p.category || 'indoor',
          label: p.label || 'AC Split Photo',
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.acSplitCustomerInfo) {
        setCustomerInfo(prefillData.acSplitCustomerInfo);
      }
      if (prefillData.acSplitReportData) {
        setReportData(prefillData.acSplitReportData);
      }
      if (prefillData.acSplitTimeSpent) {
        setTimeSpent(prefillData.acSplitTimeSpent);
      }

      toast.success('Mengekstrak data foto & parameter ke Service Report Split Wall AC!');

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  // Handler 1: Update baris inspeksi unit Indoor AC Split
  const updateIndoorItem = (idx: number, field: string, val: any) => {
    setReportData(prev => {
      const updated = [...prev.indoorInspection];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, indoorInspection: updated };
    });
  };

  // Handler 2: Update baris inspeksi unit Outdoor AC Split
  const updateOutdoorItem = (idx: number, field: string, val: any) => {
    setReportData(prev => {
      const updated = [...prev.outdoorInspection];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, outdoorInspection: updated };
    });
  };

  const updateTestItem = (idx: number, field: string, val: any) => {
    setReportData(prev => {
      const updated = [...prev.testMeasuring];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, testMeasuring: updated };
    });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-sky-900/10 text-slate-800">
      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 text-xs font-bold rounded-lg border border-cyan-200 uppercase tracking-widest">
              SERVICE REPORT — SPLIT WALL AC
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wind className="w-6 h-6 text-cyan-600" />
            Laporan Pemeliharaan Split Wall AC
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            NeutraDC Cikarang — Service Report Format Resmi Split Wall AC.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-slate-200 mb-6">
        {[
          { id: 'indoor', label: '1. Indoor Unit (13)' },
          { id: 'outdoor', label: '2. Outdoor Unit (9)' },
          { id: 'testing', label: '3. Test & Measuring' },
          { id: 'analysis', label: '4. Analysis & Remark' },
          { id: 'customer', label: 'Customer Info' },
          { id: 'time', label: 'Time Spent' },
          { id: 'photos', label: `Dokumentasi (${photos.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: INDOOR UNIT */}
      {activeTab === 'indoor' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Inspection & Cleaning Indoor Unit
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-48">Parameter</th>
                  <th className="p-3 w-36 text-center">Condition</th>
                  <th className="p-3 w-44">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.indoorInspection.map((item, idx) => (
                  <tr key={`indoor-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                    <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                    <td className="p-3 text-slate-500">{item.parameter}</td>
                    <td className="p-3 text-center">
                      <select
                        value={item.isGood ? 'Good' : 'Not Good'}
                        onChange={e => {
                          const isG = e.target.value === 'Good';
                          updateIndoorItem(idx, 'isGood', isG);
                          updateIndoorItem(idx, 'isNotGood', !isG);
                        }}
                        className={`w-full border font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                          item.isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <option value="Good">Good</option>
                        <option value="Not Good">Not Good</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateIndoorItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan..."
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OUTDOOR UNIT */}
      {activeTab === 'outdoor' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Inspection & Cleaning Outdoor Unit
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-48">Parameter</th>
                  <th className="p-3 w-36 text-center">Condition</th>
                  <th className="p-3 w-44">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.outdoorInspection.map((item, idx) => (
                  <tr key={`outdoor-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                    <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                    <td className="p-3 text-slate-500">{item.parameter}</td>
                    <td className="p-3 text-center">
                      <select
                        value={item.isGood ? 'Good' : 'Not Good'}
                        onChange={e => {
                          const isG = e.target.value === 'Good';
                          updateOutdoorItem(idx, 'isGood', isG);
                          updateOutdoorItem(idx, 'isNotGood', !isG);
                        }}
                        className={`w-full border font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                          item.isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <option value="Good">Good</option>
                        <option value="Not Good">Not Good</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateOutdoorItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan..."
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEST & MEASURING */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Test and measuring
          </h3>
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-xs">
            {reportData.testMeasuring.map((item, idx) => (
              <div key={`test-${idx}`} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">{item.no}</span>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.activity}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">Parameter: {item.parameter}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {idx === 0 && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Result Before</label>
                        <input
                          type="text"
                          value={item.resultBefore || ''}
                          onChange={e => updateTestItem(idx, 'resultBefore', e.target.value)}
                          placeholder="Good / Normal"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Result After</label>
                        <input
                          type="text"
                          value={item.resultAfter || ''}
                          onChange={e => updateTestItem(idx, 'resultAfter', e.target.value)}
                          placeholder="Good / Normal"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                        />
                      </div>
                    </>
                  )}

                  {idx === 1 && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Voltage (VAC)</label>
                        <input
                          type="text"
                          value={item.resultVoltage || ''}
                          onChange={e => updateTestItem(idx, 'resultVoltage', e.target.value)}
                          placeholder="225 V"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Current (Ampere)</label>
                        <input
                          type="text"
                          value={item.resultCurrent || ''}
                          onChange={e => updateTestItem(idx, 'resultCurrent', e.target.value)}
                          placeholder="6.5 A"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                        />
                      </div>
                    </>
                  )}

                  {(idx === 2 || idx === 3) && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Result Value</label>
                      <input
                        type="text"
                        value={item.resultVal || ''}
                        onChange={e => updateTestItem(idx, 'resultVal', e.target.value)}
                        placeholder={idx === 2 ? '130 psi' : 'Normal operation'}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={item.remarks || ''}
                      onChange={e => updateTestItem(idx, 'remarks', e.target.value)}
                      placeholder="Catatan..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ANALYSIS & REMARKS */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Analysis & Status Remarks</h3>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm text-xs">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isNormal}
                  onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, isNormal: e.target.checked, isAbnormal: !e.target.checked } }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="font-bold text-emerald-600 text-sm">Normal Operation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isAbnormal}
                  onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, isAbnormal: e.target.checked, isNormal: !e.target.checked } }))}
                  className="w-4 h-4 text-rose-600 rounded"
                />
                <span className="font-bold text-rose-600 text-sm">Abnormal Operation</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Remark / Catatan Tambahan</label>
              <textarea
                rows={3}
                value={reportData.analysis.remark}
                onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, remark: e.target.value } }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Catatan analisis operasi..."
              />
            </div>

            {reportData.analysis.isAbnormal && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Fault Symptom</label>
                  <input type="text" value={reportData.analysis.faultSymptom} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultSymptom: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Fault Analysis</label>
                  <input type="text" value={reportData.analysis.faultAnalysis} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultAnalysis: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Work Done / Action Taken</label>
                  <input type="text" value={reportData.analysis.workDone} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, workDone: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Fault Part SN</label>
                    <input type="text" value={reportData.analysis.faultPartSN} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultPartSN: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Fault Part Name</label>
                    <input type="text" value={reportData.analysis.faultPartName} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultPartName: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER INFO */}
      {activeTab === 'customer' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Informasi Pelanggan & Peralatan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Company Name</label>
              <input type="text" value={customerInfo.companyName} onChange={e => setCustomerInfo(p => ({ ...p, companyName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Type</label>
              <input type="text" value={customerInfo.type} onChange={e => setCustomerInfo(p => ({ ...p, type: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Specification</label>
              <input type="text" value={customerInfo.specification} onChange={e => setCustomerInfo(p => ({ ...p, specification: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">MOP No.</label>
              <input type="text" value={customerInfo.mopNo} onChange={e => setCustomerInfo(p => ({ ...p, mopNo: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-blue-600 font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Equipment Name</label>
              <input type="text" value={customerInfo.equipmentName} onChange={e => setCustomerInfo(p => ({ ...p, equipmentName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Serial No.</label>
              <input type="text" value={customerInfo.serialNo} onChange={e => setCustomerInfo(p => ({ ...p, serialNo: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Quarter</label>
              <input type="text" value={customerInfo.quarter} onChange={e => setCustomerInfo(p => ({ ...p, quarter: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">CI Description</label>
              <input type="text" value={customerInfo.ciDescription} onChange={e => setCustomerInfo(p => ({ ...p, ciDescription: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Product Name</label>
              <input type="text" value={customerInfo.productName} onChange={e => setCustomerInfo(p => ({ ...p, productName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Location</label>
              <input type="text" value={customerInfo.location} onChange={e => setCustomerInfo(p => ({ ...p, location: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Date</label>
              <input type="date" value={customerInfo.date} onChange={e => setCustomerInfo(p => ({ ...p, date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Prod. Year</label>
              <input type="text" value={customerInfo.prodYear} onChange={e => setCustomerInfo(p => ({ ...p, prodYear: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Area</label>
              <input type="text" value={customerInfo.area} onChange={e => setCustomerInfo(p => ({ ...p, area: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Engineer</label>
              <input type="text" value={customerInfo.engineer} onChange={e => setCustomerInfo(p => ({ ...p, engineer: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TIME SPENT */}
      {activeTab === 'time' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Waktu Operasional Maintenance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Tanggal</label>
              <input type="date" value={timeSpent.date} onChange={e => setTimeSpent(p => ({ ...p, date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Departure</label>
              <input type="text" value={timeSpent.departure} onChange={e => setTimeSpent(p => ({ ...p, departure: e.target.value }))} placeholder="08:00" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Start</label>
              <input type="text" value={timeSpent.start} onChange={e => setTimeSpent(p => ({ ...p, start: e.target.value }))} placeholder="09:00" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Finish</label>
              <input type="text" value={timeSpent.finish} onChange={e => setTimeSpent(p => ({ ...p, finish: e.target.value }))} placeholder="17:00" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PHOTOS */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Foto Dokumentasi Terhubung ({photos.length})</h3>
          {photos.length === 0 ? (
            <p className="text-slate-500 text-xs">Belum ada foto disinkronkan dari kartu dokumentasi laporan.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map(p => (
                <div key={p.id} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative group">
                  <img src={p.preview} alt={p.label} className="w-full h-28 object-cover rounded-lg mb-2" />
                  <p className="text-[11px] text-slate-800 font-medium truncate">{p.label}</p>
                  {p.parameter && <p className="text-[10px] text-blue-600 font-bold">{p.parameter}</p>}
                  <button
                    onClick={() => setPreviewImage(p.preview)}
                    className="absolute top-4 right-4 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Action Footer for Service Report & Documentation PDF Generation */}
      <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 font-medium">
          * Laporan Service Report & Dokumentasi PDF akan digenerasi secara lengkap sesuai standar resmi PT. Dwi Mitra Ekatama Mandiri
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => generateACSplitReportExcel(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.base64, description: p.label })))}
            className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileType className="w-4 h-4" />
            EXPORT EXCEL
          </button>
          <button
            type="button"
            onClick={() => generateACSplitReportPDF(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.base64, description: p.label })))}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <FileType className="w-4 h-4" />
            GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
