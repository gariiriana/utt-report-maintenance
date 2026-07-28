import { useState, useEffect } from 'react';
import { FileType, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  DocklevelerCustomerInfo,
  DocklevelerReportData,
  DocklevelerTimeSpent,
  DEFAULT_DOCKLEVELER_CUSTOMER_INFO,
  DEFAULT_DOCKLEVELER_VISUAL_ITEMS,
  DEFAULT_DOCKLEVELER_CLEANING_ITEMS,
  DEFAULT_DOCKLEVELER_NOISE,
  DEFAULT_DOCKLEVELER_GROUNDING,
  DEFAULT_DOCKLEVELER_VOLTAGE_AMPERE,
  DEFAULT_DOCKLEVELER_ANALYSIS,
  DEFAULT_DOCKLEVELER_TIME_SPENT,
} from '@/types/docklevelerReportTypes';
import { generateDocklevelerReportPDF } from '@/service_reports/dockleveler/generateDocklevelerReportPDF';

interface UploadedPhoto {
  id: string;
  base64: string;
  preview: string;
  category: string;
  label: string;
  parameter?: string;
}

interface DocklevelerServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: DocklevelerCustomerInfo; reportData: DocklevelerReportData; timeSpent: DocklevelerTimeSpent }) => void;
}

export function DocklevelerServiceReport({ prefillData, onClearPrefill, onChange }: DocklevelerServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<DocklevelerCustomerInfo>(DEFAULT_DOCKLEVELER_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<DocklevelerReportData>({
    customerInfo: DEFAULT_DOCKLEVELER_CUSTOMER_INFO,
    visualInspection: DEFAULT_DOCKLEVELER_VISUAL_ITEMS,
    cleaning: DEFAULT_DOCKLEVELER_CLEANING_ITEMS,
    noise: DEFAULT_DOCKLEVELER_NOISE,
    grounding: DEFAULT_DOCKLEVELER_GROUNDING,
    voltageAmpere: DEFAULT_DOCKLEVELER_VOLTAGE_AMPERE,
    analysis: DEFAULT_DOCKLEVELER_ANALYSIS,
    timeSpent: DEFAULT_DOCKLEVELER_TIME_SPENT,
  });
  const [timeSpent, setTimeSpent] = useState<DocklevelerTimeSpent>(DEFAULT_DOCKLEVELER_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'visual' | 'cleaning' | 'measurements' | 'analysis' | 'customer' | 'time' | 'photos'>('visual');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Sync state with parent
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  // Load from prefill or sinkronisasi
  useEffect(() => {
    if (prefillData) {
      if (prefillData.photos) {
        const mappedPhotos: UploadedPhoto[] = prefillData.photos.map((p: any, i: number) => ({
          id: `dl-p-${i}-${Date.now()}`,
          base64: p.base64 || '',
          preview: p.preview || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : ''),
          category: p.category || 'dockleveler',
          label: p.label || 'Foto Dock Leveler',
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.customerInfo) setCustomerInfo(prefillData.customerInfo);
      if (prefillData.reportData) setReportData(prefillData.reportData);
      if (prefillData.timeSpent) setTimeSpent(prefillData.timeSpent);

      toast.success('Mengekstrak data foto & parameter ke Service Report Dock Leveler!');

      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, onClearPrefill]);

  const updateVisualItem = (idx: number, field: string, val: any) => {
    setReportData((prev) => {
      const updated = [...prev.visualInspection];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, visualInspection: updated };
    });
  };

  const updateCleaningItem = (idx: number, field: string, val: any) => {
    setReportData((prev) => {
      const updated = [...prev.cleaning];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, cleaning: updated };
    });
  };

  const handleExportPDF = async () => {
    try {
      toast.loading('Generating PDF Dock Leveler Service Report...', { id: 'dl-pdf-toast' });
      await generateDocklevelerReportPDF(
        customerInfo,
        reportData,
        timeSpent,
        photos.map((p) => ({ photoBase64: p.base64, description: p.label || 'Foto Dock Leveler' }))
      );
      toast.success('PDF Service Report Dock Leveler berhasil dibuat!', { id: 'dl-pdf-toast' });
    } catch (err: any) {
      console.error('PDF export error', err);
      toast.error(`Gagal membuat PDF: ${err.message}`, { id: 'dl-pdf-toast' });
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-sky-900/10 text-slate-800">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 uppercase tracking-widest">
              SERVICE REPORT — DOCK LEVELER
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            Laporan Pemeliharaan Dock Leveler
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            PT. DWI MITRA EKATAMA MANDIRI — Neutra DC Cikarang
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-slate-200 mb-6">
        {[
          { id: 'visual', label: 'Visual Inspection (7 Items)' },
          { id: 'cleaning', label: 'Cleaning (5 Items)' },
          { id: 'measurements', label: 'Noise, Grounding & Voltage' },
          { id: 'analysis', label: 'Analysis & Remark' },
          { id: 'customer', label: 'Customer Info' },
          { id: 'time', label: 'Time Spent' },
          { id: 'photos', label: `Dokumentasi (${photos.length})` },
        ].map((tab) => (
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

      {/* TAB 1: VISUAL INSPECTION */}
      {activeTab === 'visual' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Visual inspection & Maintenance (7 Items)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-64">Parameter</th>
                    <th className="p-3 w-32 text-center">Condition</th>
                    <th className="p-3 w-48">Remarks (2-5 Kata)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.visualInspection.map((item, idx) => (
                    <tr key={`v-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                      <td className="p-3 text-slate-500">{item.parameter}</td>
                      <td className="p-3 text-center">
                        <select
                          value={item.isGood ? 'OK' : item.isNotGood ? 'NOK' : 'OK'}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateVisualItem(idx, 'isGood', val === 'OK');
                            updateVisualItem(idx, 'isNotGood', val === 'NOK');
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK">Good (√)</option>
                          <option value="NOK">Not Good (×)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => updateVisualItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLEANING */}
      {activeTab === 'cleaning' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Cleaning & Maintenance (5 Items)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-64">Parameter</th>
                    <th className="p-3 w-32 text-center">Condition</th>
                    <th className="p-3 w-48">Remarks (2-5 Kata)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.cleaning.map((item, idx) => (
                    <tr key={`c-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                      <td className="p-3 text-slate-500">{item.parameter}</td>
                      <td className="p-3 text-center">
                        <select
                          value={item.isGood ? 'OK' : item.isNotGood ? 'NOK' : 'OK'}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateCleaningItem(idx, 'isGood', val === 'OK');
                            updateCleaningItem(idx, 'isNotGood', val === 'NOK');
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK">Good (√)</option>
                          <option value="NOK">Not Good (×)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => updateCleaningItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEASUREMENTS (Noise, Grounding, Voltage & Ampere) */}
      {activeTab === 'measurements' && (
        <div className="space-y-6 text-xs">
          {/* Noise & Grounding */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Noise Measurement (Motor)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Result (dB)</label>
                  <input
                    type="text"
                    value={reportData.noise.motorResult}
                    onChange={(e) => setReportData({ ...reportData, noise: { ...reportData.noise, motorResult: e.target.value } })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Standard</label>
                  <input
                    type="text"
                    disabled
                    value={reportData.noise.standard}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 text-slate-500 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Grounding Measurement (Breaker)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Result (Ω)</label>
                  <input
                    type="text"
                    value={reportData.grounding.breakerResult}
                    onChange={(e) => setReportData({ ...reportData, grounding: { ...reportData.grounding, breakerResult: e.target.value } })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Standard</label>
                  <input
                    type="text"
                    disabled
                    value={reportData.grounding.standard}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 text-slate-500 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Voltage & Ampere */}
          <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Voltage & Ampere Measurement
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">R - S (Volt)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.voltageRS}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, voltageRS: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">S - T (Volt)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.voltageST}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, voltageST: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">T - R (Volt)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.voltageTR}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, voltageTR: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">N - G (Volt)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.voltageNG}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, voltageNG: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ampere R (A)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.ampereR}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, ampereR: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ampere S (A)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.ampereS}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, ampereS: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ampere T (A)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.ampereT}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, ampereT: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ampere N (A)</label>
                <input
                  type="text"
                  value={reportData.voltageAmpere.ampereN}
                  onChange={(e) => setReportData({ ...reportData, voltageAmpere: { ...reportData.voltageAmpere, ampereN: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANALYSIS & REMARK */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Normal Operation
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Remark :</label>
              <textarea
                rows={3}
                value={reportData.analysis.remark}
                onChange={(e) => setReportData({ ...reportData, analysis: { ...reportData.analysis, remark: e.target.value } })}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-blue-500"
                placeholder="Catatan operasi normal..."
              />
            </div>
          </div>

          <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              Abnormal Operation (Optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fault Symptom</label>
                <input
                  type="text"
                  value={reportData.analysis.faultSymptom}
                  onChange={(e) => setReportData({ ...reportData, analysis: { ...reportData.analysis, faultSymptom: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fault Analysis</label>
                <input
                  type="text"
                  value={reportData.analysis.faultAnalysis}
                  onChange={(e) => setReportData({ ...reportData, analysis: { ...reportData.analysis, faultAnalysis: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Done / Action Taken</label>
                <input
                  type="text"
                  value={reportData.analysis.workDone}
                  onChange={(e) => setReportData({ ...reportData, analysis: { ...reportData.analysis, workDone: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fault Part SN</label>
                <input
                  type="text"
                  value={reportData.analysis.faultPartSN}
                  onChange={(e) => setReportData({ ...reportData, analysis: { ...reportData.analysis, faultPartSN: e.target.value } })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER INFO */}
      {activeTab === 'customer' && (
        <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Informasi Customer & Equipment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={customerInfo.companyName}
                onChange={(e) => setCustomerInfo({ ...customerInfo, companyName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Equipment Name</label>
              <input
                type="text"
                value={customerInfo.equipmentName}
                onChange={(e) => setCustomerInfo({ ...customerInfo, equipmentName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Type</label>
              <input
                type="text"
                value={customerInfo.type}
                onChange={(e) => setCustomerInfo({ ...customerInfo, type: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Specification</label>
              <input
                type="text"
                value={customerInfo.specification}
                onChange={(e) => setCustomerInfo({ ...customerInfo, specification: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Serial No</label>
              <input
                type="text"
                value={customerInfo.serialNo}
                onChange={(e) => setCustomerInfo({ ...customerInfo, serialNo: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">MOP No</label>
              <input
                type="text"
                value={customerInfo.mopNo}
                onChange={(e) => setCustomerInfo({ ...customerInfo, mopNo: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TIME SPENT */}
      {activeTab === 'time' && (
        <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Waktu Pelaksanaan (Time Spent)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={timeSpent.date}
                onChange={(e) => setTimeSpent({ ...timeSpent, date: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Departure</label>
              <input
                type="time"
                value={timeSpent.departure}
                onChange={(e) => setTimeSpent({ ...timeSpent, departure: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Start</label>
              <input
                type="time"
                value={timeSpent.start}
                onChange={(e) => setTimeSpent({ ...timeSpent, start: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Finish</label>
              <input
                type="time"
                value={timeSpent.finish}
                onChange={(e) => setTimeSpent({ ...timeSpent, finish: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PHOTOS */}
      {activeTab === 'photos' && (
        <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Dokumentasi Foto ({photos.length})
          </h3>
          {photos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada foto yang disinkronkan dari kartu atas.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((p, idx) => (
                <div key={idx} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <img
                    src={p.preview}
                    alt={p.label}
                    onClick={() => setPreviewImage(p.preview)}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                  />
                  <p className="text-[10px] font-bold text-slate-700 truncate">{p.label}</p>
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
        <button
          type="button"
          onClick={handleExportPDF}
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <FileType className="w-4 h-4" />
          GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
        </button>
      </div>

      {/* Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
