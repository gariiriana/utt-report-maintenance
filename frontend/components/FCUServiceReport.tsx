import { useState, useEffect } from 'react';
import { Eye, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { generateFCUServiceReportPDF } from '@/service_reports/fcu/generateFCUReportPDF';
import { generateFCUReportExcel } from '@/service_reports/fcu/generateFCUReportExcel';

import {
  FCUReportData, FCUCustomerInfo, FCUTimeSpent,
  DEFAULT_FCU_CUSTOMER_INFO, DEFAULT_FCU_REPORT_DATA, DEFAULT_FCU_TIME_SPENT,
  FCUInspectionItem, FCUPhotoInput
} from '@/types/fcuReportTypes';

interface UploadedPhoto {
  id: string;
  base64: string;
  preview: string;
  category: string;
  label: string;
  parameter?: string;
}

interface FCUServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: FCUCustomerInfo; reportData: FCUReportData; timeSpent: FCUTimeSpent }) => void;
}

export function FCUServiceReport({ prefillData, onClearPrefill, onChange }: FCUServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<FCUCustomerInfo>(DEFAULT_FCU_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<FCUReportData>(DEFAULT_FCU_REPORT_DATA);
  const [timeSpent, setTimeSpent] = useState<FCUTimeSpent>(DEFAULT_FCU_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'customer' | 'photos' | 'visual' | 'cleaning' | 'measurements' | 'status' | 'time'>('visual');
  const [_isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Sync state with parent onChange
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  // Load from prefill or sinkronisasi
  useEffect(() => {
    if (prefillData) {
      let mappedPhotos: UploadedPhoto[] = [];
      if (prefillData.photos) {
        mappedPhotos = prefillData.photos.map((p: any, i: number) => ({
          id: `fcu-p-${i}-${Date.now()}`,
          base64: p.base64 || '',
          preview: p.preview || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : ''),
          category: p.category || 'visual_inspection',
          label: p.label || 'FCU Photo',
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.fcuCustomerInfo) {
        setCustomerInfo(prefillData.fcuCustomerInfo);
      }
      if (prefillData.fcuReportData) {
        setReportData(prefillData.fcuReportData);
      }
      if (prefillData.fcuTimeSpent) {
        setTimeSpent(prefillData.fcuTimeSpent);
      }

      toast.success('Mengekstrak data foto & parameter ke SR FCU di bawah!');

      if (mappedPhotos.length > 0) {
        handleGenerateAI(mappedPhotos);
      }

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  // Trigger AI Report Generation
  const handleGenerateAI = async (overridePhotos?: UploadedPhoto[]) => {
    const targetPhotos = overridePhotos || photos;
    try {
      setIsGeneratingAI(true);
      toast.info('Menghubungi AI Agent untuk menganalisis data SR FCU...', { id: 'fcu-ai-toast' });

      const photosInput: FCUPhotoInput[] = targetPhotos.map(p => ({
        base64: p.base64 || '',
        category: p.category || 'visual_inspection',
        label: p.label || '',
        parameter: p.parameter || '',
      }));

      const res = await fetch('/api/ai/fcu-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photosInput,
          report_data: reportData,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const generatedData: FCUReportData = await res.json();
      setReportData(generatedData);
      toast.success('AI Service Report FCU berhasil dibuat!', { id: 'fcu-ai-toast' });
    } catch (err: any) {
      console.error('FCU AI Generation Error:', err);
      toast.error(`Gagal membuat AI Report FCU: ${err.message}`, { id: 'fcu-ai-toast' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Helper updater for visual inspection items
  const updateVisualItem = (index: number, field: keyof FCUInspectionItem, value: string) => {
    setReportData(prev => {
      const updated = [...prev.visual_inspection];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, visual_inspection: updated };
    });
  };

  // Helper updater for cleaning items
  const updateCleaningItem = (index: number, field: keyof FCUInspectionItem, value: string) => {
    setReportData(prev => {
      const updated = [...prev.cleaning];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cleaning: updated };
    });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-sky-900/10 text-slate-800 space-y-5 sm:space-y-6">
      {/* Header & Title Card */}
      <div className="bg-gradient-to-r from-sky-50 via-blue-50/70 to-indigo-50/70 border border-sky-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-wide">
                Service Report — FCU (Fan Coil Unit)
              </h1>
              <span className="bg-cyan-100/90 text-cyan-800 text-[10px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-full font-bold border border-cyan-300 shadow-sm">
                Neutra DC Cikarang
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Laporan pemeliharaan rutin Fan Coil Unit (FCU) & Analisis AI Co-Pilot.
            </p>
          </div>
        </div>

        {/* Global AI Limit Tracker Bar */}
        <div className="pt-3 border-t border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-black tracking-wider text-violet-800 bg-violet-100 px-2 py-0.5 rounded border border-violet-300">
              🤖 Kuota AI Global
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              6,000 / 6,000 request tersisa hari ini
            </span>
          </div>
          <div className="w-full sm:w-48 bg-slate-200 rounded-full h-1.5 overflow-hidden border border-slate-300">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2.5 border-b border-slate-200 text-xs sm:text-sm font-medium -mx-2 px-2 sm:mx-0 sm:px-0">
        {[
          { id: 'customer', label: 'Customer Info' },
          { id: 'photos', label: `Foto Dokumentasi (${photos.length})` },
          { id: 'visual', label: `Visual Inspection (${reportData.visual_inspection.length})` },
          { id: 'cleaning', label: `Cleaning (${reportData.cleaning.length})` },
          { id: 'measurements', label: 'Measurements' },
          { id: 'status', label: 'Analysis & Remark' },
          { id: 'time', label: 'Time Spent' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-xs sm:text-sm font-bold cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 bg-white/80 border border-slate-200/80 hover:bg-white hover:text-slate-900 shadow-sm'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6 pt-1">
        {/* 1. CUSTOMER INFO */}
        {activeTab === 'customer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {Object.keys(customerInfo).map(key => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] sm:text-xs text-slate-700 uppercase font-bold tracking-wider">
                  {key.replace(/([A-Z])/g, ' $1')}
                </label>
                <input
                  type="text"
                  value={(customerInfo as any)[key]}
                  onChange={e => setCustomerInfo(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* 2. FOTO DOKUMENTASI GALLERY */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            {photos.length === 0 ? (
              <div className="text-center py-10 sm:py-12 bg-sky-50/50 rounded-2xl border border-sky-100 p-4">
                <p className="text-slate-600 text-xs sm:text-sm font-medium">Belum ada foto disinkronkan. Klik tombol <span className="font-bold text-slate-900">"SINKRONISASI KE FCU"</span> di atas untuk mengimpor foto & parameter dari kartu di atas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                {photos.map(p => (
                  <div key={p.id} className="relative group bg-white rounded-xl p-2 border border-slate-200 flex flex-col gap-1 shadow-sm">
                    {p.preview && (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100">
                        <img src={p.preview} alt={p.label} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPreviewImage(p.preview)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-800 truncate">{p.label}</p>
                    {p.parameter && (
                      <p className="text-[9px] font-mono text-emerald-700 truncate bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded font-bold">{p.parameter}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. VISUAL INSPECTION */}
        {activeTab === 'visual' && (
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm text-slate-800 min-w-[620px]">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-40">Parameter</th>
                  <th className="p-3 w-32">Condition</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.visual_inspection.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-center text-slate-500">{item.no}</td>
                    <td className="p-3 font-bold text-slate-900">{item.activity}</td>
                    <td className="p-3 text-slate-600 font-medium">{item.parameter}</td>
                    <td className="p-3">
                      <select
                        value={item.condition}
                        onChange={e => updateVisualItem(idx, 'condition', e.target.value as any)}
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer shadow-sm ${
                          item.condition === 'Good'
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 font-bold'
                            : 'border-rose-300 bg-rose-50/70 text-rose-800 font-bold'
                        }`}
                      >
                        <option value="Good">Good</option>
                        <option value="Not good">Not good</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateVisualItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan / keterangan..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. CLEANING */}
        {activeTab === 'cleaning' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm text-slate-800">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-40">Parameter</th>
                  <th className="p-3 w-32">Condition</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.cleaning.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-center text-slate-500">{item.no}</td>
                    <td className="p-3 font-bold text-slate-900">{item.activity}</td>
                    <td className="p-3 text-slate-600 font-medium">{item.parameter}</td>
                    <td className="p-3">
                      <select
                        value={item.condition}
                        onChange={e => updateCleaningItem(idx, 'condition', e.target.value as any)}
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer shadow-sm ${
                          item.condition === 'Good'
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 font-bold'
                            : 'border-rose-300 bg-rose-50/70 text-rose-800 font-bold'
                        }`}
                      >
                        <option value="Good">Good</option>
                        <option value="Not good">Not good</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateCleaningItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan / keterangan..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. MEASUREMENTS */}
        {activeTab === 'measurements' && (
          <div className="space-y-6">
            {/* Voltage & Current */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">a. Measurement Input / Output Voltage & Current</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">R-N Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_rn}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_rn: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">S-N Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_sn}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_sn: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">T-N Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_tn}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_tn: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">R-S Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_rs}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_rs: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">S-T Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_st}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_st: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">T-R Voltage</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.voltage_tr}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, voltage_tr: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Current R</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.current_r}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, current_r: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Current S</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.current_s}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, current_s: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Current T</label>
                  <input
                    type="text"
                    value={reportData.voltage_current.current_t}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      voltage_current: { ...prev.voltage_current, current_t: e.target.value }
                    }))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Vibration & Noise */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">b. Measurement Vibration & Noise (Standart: Vibration ≤ 2.5, Noise ≤ 65 dB)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Vibration</label>
                  <input
                    type="text"
                    value={reportData.vibration_noise.vibration}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      vibration_noise: { ...prev.vibration_noise, vibration: e.target.value }
                    }))}
                    placeholder="e.g. 1.2"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Noise (dB)</label>
                  <input
                    type="text"
                    value={reportData.vibration_noise.noise}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      vibration_noise: { ...prev.vibration_noise, noise: e.target.value }
                    }))}
                    placeholder="e.g. 58 dB"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Temp & Humidity */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">c. Measurements Temperature & Humidity (Standart: Temp ≤ ±25°C, RH ≤ ±60%)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Temperature (°C)</label>
                  <input
                    type="text"
                    value={reportData.temp_humidity.temp}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      temp_humidity: { ...prev.temp_humidity, temp: e.target.value }
                    }))}
                    placeholder="e.g. 22°C"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">RH (%)</label>
                  <input
                    type="text"
                    value={reportData.temp_humidity.rh}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      temp_humidity: { ...prev.temp_humidity, rh: e.target.value }
                    }))}
                    placeholder="e.g. 52%"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Pipe Pressure */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">d. Measurement of Supply & Return Pipes (Standart: 2.5 - 4 Bar)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Supply Pressure (Bar)</label>
                  <input
                    type="text"
                    value={reportData.pipe_pressure.supply}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      pipe_pressure: { ...prev.pipe_pressure, supply: e.target.value }
                    }))}
                    placeholder="e.g. 3.2 Bar"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold mb-1 block">Return Pressure (Bar)</label>
                  <input
                    type="text"
                    value={reportData.pipe_pressure.return_val}
                    onChange={e => setReportData(prev => ({
                      ...prev,
                      pipe_pressure: { ...prev.pipe_pressure, return_val: e.target.value }
                    }))}
                    placeholder="e.g. 3.0 Bar"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Air Flow */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">e. Measurement of Output Air Flow (Standart: 2.0 - 8.0 m/s)</h3>
              <div className="text-xs">
                <label className="text-slate-700 font-bold mb-1 block">Air Flow (m/s)</label>
                <input
                  type="text"
                  value={reportData.air_flow.air_flow}
                  onChange={e => setReportData(prev => ({
                    ...prev,
                    air_flow: { ...prev.air_flow, air_flow: e.target.value }
                  }))}
                  placeholder="e.g. 4.5 m/s"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. ANALYSIS / REMARK */}
        {activeTab === 'status' && (
          <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fcu-op-status"
                  checked={reportData.operation_status.is_normal}
                  onChange={() => setReportData(prev => ({
                    ...prev,
                    operation_status: { ...prev.operation_status, is_normal: true }
                  }))}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-emerald-700">Normal Operation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fcu-op-status"
                  checked={!reportData.operation_status.is_normal}
                  onChange={() => setReportData(prev => ({
                    ...prev,
                    operation_status: { ...prev.operation_status, is_normal: false }
                  }))}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm font-bold text-rose-700">Abnormal Operation</span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold mb-1 block">Remark</label>
                <textarea
                  value={reportData.operation_status.remark}
                  onChange={e => setReportData(prev => ({
                    ...prev,
                    operation_status: { ...prev.operation_status, remark: e.target.value }
                  }))}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  placeholder="Keterangan kondisi operasional secara umum..."
                />
              </div>
              {!reportData.operation_status.is_normal && (
                <>
                  <div>
                    <label className="text-slate-700 font-bold mb-1 block">Fault Symptom</label>
                    <input
                      type="text"
                      value={reportData.operation_status.fault_symptom}
                      onChange={e => setReportData(prev => ({
                        ...prev,
                        operation_status: { ...prev.operation_status, fault_symptom: e.target.value }
                      }))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold mb-1 block">Fault Analysis</label>
                    <textarea
                      value={reportData.operation_status.fault_analysis}
                      onChange={e => setReportData(prev => ({
                        ...prev,
                        operation_status: { ...prev.operation_status, fault_analysis: e.target.value }
                      }))}
                      rows={2}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold mb-1 block">Work Done / Action Taken</label>
                    <textarea
                      value={reportData.operation_status.work_done}
                      onChange={e => setReportData(prev => ({
                        ...prev,
                        operation_status: { ...prev.operation_status, work_done: e.target.value }
                      }))}
                      rows={2}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 7. TIME SPENT */}
        {activeTab === 'time' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <label className="text-slate-700 font-bold mb-1 block">Date</label>
              <input
                type="date"
                value={timeSpent.date}
                onChange={e => setTimeSpent(prev => ({ ...prev, date: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="text-slate-700 font-bold mb-1 block">Departure</label>
              <input
                type="time"
                value={timeSpent.departure}
                onChange={e => setTimeSpent(prev => ({ ...prev, departure: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="text-slate-700 font-bold mb-1 block">Start</label>
              <input
                type="time"
                value={timeSpent.start}
                onChange={e => setTimeSpent(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="text-slate-700 font-bold mb-1 block">Finish</label>
              <input
                type="time"
                value={timeSpent.finish}
                onChange={e => setTimeSpent(prev => ({ ...prev, finish: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
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
              onClick={() => generateFCUReportExcel(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.base64, description: p.label })))}
              className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileType className="w-4 h-4" />
              EXPORT EXCEL
            </button>
            <button
              type="button"
              onClick={() => generateFCUServiceReportPDF(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.base64, description: p.label })))}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FileType className="w-4 h-4" />
              GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={previewImage} alt="Preview" className="max-w-4xl max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20" />
        </div>
      )}
    </div>
  );
}
