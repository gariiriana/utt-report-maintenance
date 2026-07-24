import { useState, useEffect } from 'react';
import { Eye, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  TrafoCustomerInfo,
  TrafoReportData,
  TrafoTimeSpent,
  DEFAULT_TRAFO_CUSTOMER_INFO,
  DEFAULT_TRAFO_REPORT_DATA,
  DEFAULT_TRAFO_TIME_SPENT,
} from '@/types/trafoReportTypes';

interface UploadedPhoto {
  id: string;
  base64: string;
  preview: string;
  category: string;
  label: string;
  parameter?: string;
}

interface TrafoServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: TrafoCustomerInfo; reportData: TrafoReportData; timeSpent: TrafoTimeSpent }) => void;
}

export function TrafoServiceReport({ prefillData, onClearPrefill, onChange }: TrafoServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<TrafoCustomerInfo>(DEFAULT_TRAFO_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<TrafoReportData>(DEFAULT_TRAFO_REPORT_DATA);
  const [timeSpent, setTimeSpent] = useState<TrafoTimeSpent>(DEFAULT_TRAFO_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'format1' | 'format2' | 'analysis' | 'customer' | 'time' | 'photos'>('format1');
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
          id: `trafo-p-${i}-${Date.now()}`,
          base64: p.base64 || '',
          preview: p.preview || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : ''),
          category: p.category || 'trafo',
          label: p.label || 'Trafo Photo',
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.trafoCustomerInfo) setCustomerInfo(prefillData.trafoCustomerInfo);
      if (prefillData.trafoReportData) setReportData(prefillData.trafoReportData);
      if (prefillData.trafoTimeSpent) setTimeSpent(prefillData.trafoTimeSpent);

      toast.success('Mengekstrak data foto & parameter ke Service Report Transformator!');

      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, onClearPrefill]);

  const updateVisualItem = (idx: number, field: string, val: any) => {
    setReportData(prev => {
      const updated = [...prev.visualInspection];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, visualInspection: updated };
    });
  };

  const updateCleaningItem = (idx: number, field: string, val: any) => {
    setReportData(prev => {
      const updated = [...prev.cleaning];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, cleaning: updated };
    });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-sky-900/10 text-slate-800">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200 uppercase tracking-widest">
              SERVICE REPORT — TRANSFORMATOR (2 FORMAT)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-600" />
            Laporan Pemeliharaan Transformator
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Neutra DC Cikarang — Mendukung ekspor otomatis 2 berkas PDF Service Report sekaligus.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-slate-200 mb-6">
        {[
          { id: 'format1', label: 'SR #1 (Inspeksi & Testing)' },
          { id: 'format2', label: 'SR #2 (Listrik, Noise & Thermal)' },
          { id: 'analysis', label: 'Analysis & Remark' },
          { id: 'customer', label: 'Customer Info' },
          { id: 'time', label: 'Time Spent' },
          { id: 'photos', label: `Dokumentasi (${photos.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FORMAT 1 (Visual, Cleaning, Measurement, Testing) */}
      {activeTab === 'format1' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Visual Inspection & Maintenance (Format 1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-48">Parameter</th>
                    <th className="p-3 w-32 text-center">Inspection</th>
                    <th className="p-3 w-40">Status/Remarks</th>
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
                          value={item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'NA'}
                          onChange={e => {
                            const val = e.target.value;
                            updateVisualItem(idx, 'statusOK', val === 'OK');
                            updateVisualItem(idx, 'statusNOK', val === 'NOK');
                            updateVisualItem(idx, 'statusNA', val === 'NA');
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK">Good (√)</option>
                          <option value="NOK">Not Good (×)</option>
                          <option value="NA">N/A</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => updateVisualItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Cleaning Transformer (Format 1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-48">Parameter</th>
                    <th className="p-3 w-32 text-center">Cleaning</th>
                    <th className="p-3 w-40">Status/Remarks</th>
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
                          value={item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'NA'}
                          onChange={e => {
                            const val = e.target.value;
                            updateCleaningItem(idx, 'statusOK', val === 'OK');
                            updateCleaningItem(idx, 'statusNOK', val === 'NOK');
                            updateCleaningItem(idx, 'statusNA', val === 'NA');
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK">Clean (√)</option>
                          <option value="NOK">Not Clean (×)</option>
                          <option value="NA">N/A</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => updateCleaningItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Meassurement Table (Format 1) */}
          <div>
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Meassurement Transformer (Format 1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-32">Result</th>
                    <th className="p-3 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.measurement.map((item, idx) => (
                    <tr key={`m-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                      <td className="p-3 text-slate-500">{item.parameter}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.result}
                          onChange={e => {
                            const val = e.target.value;
                            setReportData(prev => {
                              const updated = [...prev.measurement];
                              updated[idx] = { ...updated[idx], result: val };
                              return { ...prev, measurement: updated };
                            });
                          }}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none bg-white font-mono"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <select
                          value={item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'NA'}
                          onChange={e => {
                            const val = e.target.value;
                            setReportData(prev => {
                              const updated = [...prev.measurement];
                              updated[idx] = { ...updated[idx], statusOK: val === 'OK', statusNOK: val === 'NOK', statusNA: val === 'NA' };
                              return { ...prev, measurement: updated };
                            });
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK">OK</option>
                          <option value="NOK">NOK</option>
                          <option value="NA">N/A</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Testing Table (Format 1) */}
          <div>
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Testing Transformer (Format 1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-32">Result</th>
                    <th className="p-3 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.testing.map((item, idx) => (
                    <tr key={`t-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                      <td className="p-3 text-slate-500">{item.parameter}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.result}
                          onChange={e => {
                            const val = e.target.value;
                            setReportData(prev => {
                              const updated = [...prev.testing];
                              updated[idx] = { ...updated[idx], result: val };
                              return { ...prev, testing: updated };
                            });
                          }}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none bg-white font-mono"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <select
                          value={item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'NA'}
                          onChange={e => {
                            const val = e.target.value;
                            setReportData(prev => {
                              const updated = [...prev.testing];
                              updated[idx] = { ...updated[idx], statusOK: val === 'OK', statusNOK: val === 'NOK', statusNA: val === 'NA' };
                              return { ...prev, testing: updated };
                            });
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          <option value="OK font-bold text-emerald-600">OK</option>
                          <option value="NOK">NOK</option>
                          <option value="NA">N/A</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORMAT 2 (Pengukuran Listrik, Noise & Thermal) */}
      {activeTab === 'format2' && (
        <div className="space-y-6 text-xs">
          {/* Format 2 Visual Inspection & Cleaning */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Visual Inspection & Cleaning (Format 2)</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3 w-44">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.format2VisualCheck.map((item, idx) => (
                    <tr key={`f2v-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-800 font-medium">{item.activity}</td>
                      <td className="p-3 text-center">
                        <select
                          value={item.condition}
                          onChange={e => {
                            const val = e.target.value as any;
                            setReportData(prev => {
                              const updated = [...prev.format2VisualCheck];
                              updated[idx] = { ...updated[idx], condition: val };
                              return { ...prev, format2VisualCheck: updated };
                            });
                          }}
                          className="w-full border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center bg-white"
                        >
                          {idx < 5 ? (
                            <>
                              <option value="Good">Good</option>
                              <option value="Not Good">Not Good</option>
                            </>
                          ) : (
                            <>
                              <option value="Clean">Clean</option>
                              <option value="Not Clean">Not Clean</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => {
                            const val = e.target.value;
                            setReportData(prev => {
                              const updated = [...prev.format2VisualCheck];
                              updated[idx] = { ...updated[idx], remarks: val };
                              return { ...prev, format2VisualCheck: updated };
                            });
                          }}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Current & Load Recording */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Current & Load Recording (Format 2)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-500 font-bold mb-1">R-S Volt</label>
                <input type="text" value={reportData.currentLoad.rsVolt} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, rsVolt: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">S-T Volt</label>
                <input type="text" value={reportData.currentLoad.stVolt} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, stVolt: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">T-R Volt</label>
                <input type="text" value={reportData.currentLoad.trVolt} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, trVolt: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">N-G Volt</label>
                <input type="text" value={reportData.currentLoad.ngVolt} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, ngVolt: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Ampere R</label>
                <input type="text" value={reportData.currentLoad.rAmp} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, rAmp: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Ampere S</label>
                <input type="text" value={reportData.currentLoad.sAmp} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, sAmp: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Ampere T</label>
                <input type="text" value={reportData.currentLoad.tAmp} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, tAmp: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Ampere N</label>
                <input type="text" value={reportData.currentLoad.nAmp} onChange={e => setReportData(p => ({ ...p, currentLoad: { ...p.currentLoad, nAmp: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
            </div>
          </div>

          {/* Noise & Thermal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Transformer Noise (SNI 04-0204-1989)</h4>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Result (dB)</label>
                <input type="text" value={reportData.noiseMeasurement.resultDb} onChange={e => setReportData(p => ({ ...p, noiseMeasurement: { ...p.noiseMeasurement, resultDb: e.target.value } }))} placeholder="58 dB" className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <p className="text-[11px] text-slate-500 italic">Referensi SNI: 630KVA (57dB), 1000KVA (58dB), 1250KVA (59dB), 2000KVA (61dB), 5000KVA (65dB)</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Thermal Imager (Fabrication Standard)</h4>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Result Temperature (°C)</label>
                <input type="text" value={reportData.thermalImager.resultTemp} onChange={e => setReportData(p => ({ ...p, thermalImager: { ...p.thermalImager, resultTemp: e.target.value } }))} placeholder="42 °C" className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <p className="text-[11px] text-slate-500 italic">Standar Pabrik: Load 0% (35°C), 20% (45°C), 40% (55°C), 60% (65°C), 80% (80°C), 100% (90°C)</p>
            </div>
          </div>

          {/* Temperature Sensor & Module Setting */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Temperature Sensor & Temp. Module Setting</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Fan On (°C)</label>
                <input type="text" value={reportData.tempSensorSetting.fanOn} onChange={e => setReportData(p => ({ ...p, tempSensorSetting: { ...p.tempSensorSetting, fanOn: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Fan Off (°C)</label>
                <input type="text" value={reportData.tempSensorSetting.fanOff} onChange={e => setReportData(p => ({ ...p, tempSensorSetting: { ...p.tempSensorSetting, fanOff: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Alarm (°C)</label>
                <input type="text" value={reportData.tempSensorSetting.alarm} onChange={e => setReportData(p => ({ ...p, tempSensorSetting: { ...p.tempSensorSetting, alarm: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Trip (°C)</label>
                <input type="text" value={reportData.tempSensorSetting.trip} onChange={e => setReportData(p => ({ ...p, tempSensorSetting: { ...p.tempSensorSetting, trip: e.target.value } }))} className="w-full border border-slate-200 rounded-lg p-2 bg-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ANALYSIS & REMARKS */}
      {activeTab === 'analysis' && (
        <div className="space-y-4 text-xs">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">Analysis & Status Remarks</h3>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isNormal}
                  onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, isNormal: e.target.checked, isAbnormal: !e.target.checked } }))}
                  className="w-4 h-4 text-amber-600 rounded"
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
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Catatan analisis operasi..."
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMER INFO */}
      {activeTab === 'customer' && (
        <div className="space-y-4 text-xs">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">Informasi Pelanggan & Peralatan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Company Name</label>
              <input type="text" value={customerInfo.companyName} onChange={e => setCustomerInfo(p => ({ ...p, companyName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Type</label>
              <input type="text" value={customerInfo.type} onChange={e => setCustomerInfo(p => ({ ...p, type: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Spesification</label>
              <input type="text" value={customerInfo.specification} onChange={e => setCustomerInfo(p => ({ ...p, specification: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">MOP No.</label>
              <input type="text" value={customerInfo.mopNo} onChange={e => setCustomerInfo(p => ({ ...p, mopNo: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-amber-600 font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Equipment Name</label>
              <input type="text" value={customerInfo.equipmentName} onChange={e => setCustomerInfo(p => ({ ...p, equipmentName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Serial No.</label>
              <input type="text" value={customerInfo.serialNo} onChange={e => setCustomerInfo(p => ({ ...p, serialNo: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TIME SPENT */}
      {activeTab === 'time' && (
        <div className="space-y-4 text-xs">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">Waktu Operasional Maintenance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      {/* TAB 6: PHOTOS */}
      {activeTab === 'photos' && (
        <div className="space-y-4 text-xs">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">Foto Dokumentasi Terhubung ({photos.length})</h3>
          {photos.length === 0 ? (
            <p className="text-slate-500">Belum ada foto disinkronkan dari kartu dokumentasi laporan.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map(p => (
                <div key={p.id} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative group">
                  <img src={p.preview} alt={p.label} className="w-full h-28 object-cover rounded-lg mb-2" />
                  <p className="text-[11px] text-slate-800 font-medium truncate">{p.label}</p>
                  {p.parameter && <p className="text-[10px] text-amber-700 font-bold">{p.parameter}</p>}
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

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
