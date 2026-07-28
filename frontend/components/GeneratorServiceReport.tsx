import { useState, useEffect } from 'react';
import { Eye, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { generateGeneratorReportPDF } from '@/service_reports/generator/generateGeneratorReportPDF';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/api/firebase';
import {
  GensetCustomerInfo,
  GensetReportData,
  GensetTimeSpent,
  DEFAULT_GENSET_CUSTOMER_INFO,
  DEFAULT_GENSET_REPORT_DATA,
  DEFAULT_GENSET_TIME_SPENT,
  GensetInspectionItem,
  GensetCleaningItem,
} from '@/types/generatorReportTypes';

interface UploadedPhoto {
  id: string;
  preview: string;
  label: string;
  parameter?: string;
}

interface GeneratorServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: GensetCustomerInfo; reportData: GensetReportData; timeSpent: GensetTimeSpent }) => void;
}

export function GeneratorServiceReport({ prefillData, onClearPrefill, onChange }: GeneratorServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<GensetCustomerInfo>(DEFAULT_GENSET_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<GensetReportData>(DEFAULT_GENSET_REPORT_DATA);
  const [timeSpent, setTimeSpent] = useState<GensetTimeSpent>(DEFAULT_GENSET_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'customer' | 'photos' | 'inspection' | 'cleaning' | 'measurement' | 'testing' | 'analysis' | 'time'>('inspection');
  const [_isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiLimit, setAiLimit] = useState<{ total: number; used: number } | null>(null);

  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system_status', 'ai_limit_tracker'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAiLimit({
          total: Number(data.total_limit) || 6000,
          used: Number(data.used_today) || 0,
        });
      } else {
        setAiLimit({ total: 6000, used: 0 });
      }
    }, (error) => {
      console.error('Failed to listen to AI limit tracker:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (prefillData) {
      let mappedPhotos: UploadedPhoto[] = [];
      if (prefillData.photos) {
        mappedPhotos = prefillData.photos.map((p: any, i: number) => ({
          id: `genset-p-${i}-${Date.now()}`,
          preview: p.preview || p.base64 || '',
          label: p.description || p.label || `Foto #${i + 1}`,
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.generatorCustomerInfo) {
        setCustomerInfo(prefillData.generatorCustomerInfo);
      }
      if (prefillData.generatorTimeSpent) {
        setTimeSpent(prefillData.generatorTimeSpent);
      }
      if (prefillData.generatorReportData) {
        setReportData(prefillData.generatorReportData);
      }

      if (prefillData.triggerGenerateData) {
        generateGeneratorReportWithAI(mappedPhotos);
      }

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  const generateGeneratorReportWithAI = async (photoList: UploadedPhoto[]) => {
    setIsGeneratingAI(true);
    const toastId = toast.loading('Menganalisis parameter foto Generator/Genset dengan AI Co-Pilot...');
    try {
      const response = await fetch('/api/ai/generator-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photoList.map(p => ({
            label: p.label,
            parameter: p.parameter || '',
            base64: p.preview ? p.preview.split(',')[1] || p.preview : '',
          })),
          existingData: reportData,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menghubungi AI Service Genset Report');
      }

      const resData = await response.json();
      if (resData) {
        setReportData(prev => ({
          ...prev,
          ...resData,
        }));
        toast.success('Parameter Generator/Genset berhasil dianalisis AI!', { id: toastId });
      } else {
        toast.success('Selesai memproses parameter Generator/Genset.', { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal analisis AI: ' + err.message, { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const updateCustomerInfo = (field: keyof GensetCustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  };

  const updateTimeSpent = (field: keyof GensetTimeSpent, value: string) => {
    setTimeSpent(prev => ({ ...prev, [field]: value }));
  };

  const updateInspectionItem = (index: number, field: keyof GensetInspectionItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.inspection];
      if (field === 'isGood' && value) {
        updated[index] = { ...updated[index], isGood: true, isNotGood: false };
      } else if (field === 'isNotGood' && value) {
        updated[index] = { ...updated[index], isGood: false, isNotGood: true };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, inspection: updated };
    });
  };

  const updateCleaningItem = (index: number, field: keyof GensetCleaningItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.cleaning];
      if (field === 'isGood' && value) {
        updated[index] = { ...updated[index], isGood: true, isNotGood: false };
      } else if (field === 'isNotGood' && value) {
        updated[index] = { ...updated[index], isGood: false, isNotGood: true };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, cleaning: updated };
    });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100/90 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-sky-900/10 text-slate-800">
      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg border border-amber-200 uppercase tracking-widest">
              SERVICE REPORT — GENSET (GENERATOR)
            </span>
            {aiLimit && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200">
                AI Credits: {aiLimit.total - aiLimit.used} / {aiLimit.total}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Laporan Pemeliharaan Generator / Genset</h2>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Laporan pemeliharaan berkala Generator, Pengukuran Listrik/Baterai, Testing APM/AMF & Analisis AI.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 border-b border-slate-200 scrollbar-none">
        {[
          { id: 'inspection', label: '1. Visual Inspection' },
          { id: 'cleaning', label: '2. Cleaning Generator' },
          { id: 'measurement', label: '3. Measurements' },
          { id: 'testing', label: '4. Testing' },
          { id: 'analysis', label: 'Analysis & Remark' },
          { id: 'customer', label: 'Customer Info' },
          { id: 'time', label: 'Time Spent' },
          { id: 'photos', label: `Dokumentasi (${photos.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {/* Tab 1: Visual Inspection */}
        {activeTab === 'inspection' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-600 mb-2">Visual Inspection Generator</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-sky-50 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Parameter / Standard</th>
                    <th className="p-3 w-32 text-center">Condition</th>
                    <th className="p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.inspection.map((item, idx) => (
                    <tr key={idx} className="hover:bg-sky-50/50 transition">
                      <td className="p-3 text-center font-bold text-slate-400">{item.no}.</td>
                      <td className="p-3 font-semibold text-slate-800">{item.activity}</td>
                      <td className="p-3 text-slate-500">{item.parameter}</td>
                      <td className="p-3">
                        <select
                          value={item.isGood ? 'Good' : item.isNotGood ? 'Not Good' : 'Good'}
                          onChange={e => updateInspectionItem(idx, 'isGood', e.target.value === 'Good')}
                          className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none transition-all cursor-pointer ${
                            item.isGood
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                              : 'border-rose-300 text-rose-700 bg-rose-50'
                          }`}
                        >
                          <option value="Good" className="bg-white text-emerald-700 font-bold">Good</option>
                          <option value="Not Good" className="bg-white text-rose-700 font-bold">Not Good</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => updateInspectionItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500 transition"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Cleaning Generator */}
        {activeTab === 'cleaning' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Cleaning Generator</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Parameter</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {reportData.cleaning.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 text-center font-bold text-slate-400">{item.no}.</td>
                      <td className="p-3 font-medium text-white">{item.activity}</td>
                      <td className="p-3 text-slate-400">{item.parameter}</td>
                      <td className="p-3">
                        <select
                          value={item.isGood ? 'Good' : item.isNotGood ? 'Not Good' : 'Good'}
                          onChange={e => updateCleaningItem(idx, 'isGood', e.target.value === 'Good')}
                          className={`w-full bg-slate-950 border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none transition-all cursor-pointer ${
                            item.isGood
                              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                              : 'border-rose-500/50 text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          <option value="Good" className="bg-white text-emerald-600 font-bold">Good</option>
                          <option value="Not Good" className="bg-white text-rose-600 font-bold">Not Good</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => updateCleaningItem(idx, 'remarks', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Measurements */}
        {activeTab === 'measurement' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Measurements (Pengukuran Generator)</h3>
            
            {/* a. Voltage & Current Measurement */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm">a. Output Voltage, Current & Power Consumption</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                {['R-S', 'S-T', 'T-R', 'R-N', 'S-N', 'T-N', 'N-G'].map(field => (
                  <div key={field}>
                    <label className="block text-[10px] text-slate-400 mb-1">{field} (V)</label>
                    <input
                      type="text"
                      value={(reportData.measurement.outputVC as any)[field.toLowerCase().replace('-', '')] || ''}
                      onChange={e => {
                        const key = field.toLowerCase().replace('-', '');
                        setReportData(prev => ({
                          ...prev,
                          measurement: {
                            ...prev.measurement,
                            outputVC: { ...prev.measurement.outputVC, [key]: e.target.value },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-mono text-xs"
                      placeholder="0 V"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                {['R', 'S', 'T', 'N'].map(field => (
                  <div key={field}>
                    <label className="block text-[10px] text-slate-400 mb-1">Arus {field} (A)</label>
                    <input
                      type="text"
                      value={(reportData.measurement.outputVC as any)[field.toLowerCase()] || ''}
                      onChange={e => {
                        const key = field.toLowerCase();
                        setReportData(prev => ({
                          ...prev,
                          measurement: {
                            ...prev.measurement,
                            outputVC: { ...prev.measurement.outputVC, [key]: e.target.value },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-mono text-xs"
                      placeholder="0 A"
                    />
                  </div>
                ))}
                {['kW', 'kVA', 'kVAR'].map(field => (
                  <div key={field}>
                    <label className="block text-[10px] text-slate-400 mb-1">{field}</label>
                    <input
                      type="text"
                      value={(reportData.measurement.outputVC as any)[field.toLowerCase()] || ''}
                      onChange={e => {
                        const key = field.toLowerCase();
                        setReportData(prev => ({
                          ...prev,
                          measurement: {
                            ...prev.measurement,
                            outputVC: { ...prev.measurement.outputVC, [key]: e.target.value },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-400 font-mono text-xs"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* b. DC Battery Voltage & Impendance */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm">b. DC Battery Voltage (&gt; 12 VDC) &amp; Battery Impedance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-bold text-amber-400 mb-2">Back Up Battery (Cell 1 - 5)</h5>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <div key={idx}>
                        <label className="block text-[9px] text-slate-500">Cell #{idx + 1}</label>
                        <input
                          type="text"
                          value={reportData.measurement.dcBattery.backup[idx] || ''}
                          onChange={e => {
                            const updated = [...reportData.measurement.dcBattery.backup];
                            updated[idx] = e.target.value;
                            setReportData(prev => ({
                              ...prev,
                              measurement: {
                                ...prev.measurement,
                                dcBattery: { ...prev.measurement.dcBattery, backup: updated },
                              },
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-emerald-400 font-mono text-xs"
                          placeholder="V"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-amber-400 mb-2">Existing Battery (Cell 1 - 5)</h5>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <div key={idx}>
                        <label className="block text-[9px] text-slate-500">Cell #{idx + 1}</label>
                        <input
                          type="text"
                          value={reportData.measurement.dcBattery.existing[idx] || ''}
                          onChange={e => {
                            const updated = [...reportData.measurement.dcBattery.existing];
                            updated[idx] = e.target.value;
                            setReportData(prev => ({
                              ...prev,
                              measurement: {
                                ...prev.measurement,
                                dcBattery: { ...prev.measurement.dcBattery, existing: updated },
                              },
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-emerald-400 font-mono text-xs"
                          placeholder="V"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Testing */}
        {activeTab === 'testing' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Testing &amp; APM / AMF Engine Recording</h3>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
              <p className="text-xs text-slate-400">
                Pemeriksaan fungsi Emergency Stop, Parameter APM/AMF Generator, ECU Values, Temperatur &amp; Putaran Fasa (ABC / ACB).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Battery Volts (V)</label>
                  <input
                    type="text"
                    value={reportData.testing.apmAmf.batteryVolts}
                    onChange={e => setReportData(prev => ({ ...prev, testing: { ...prev.testing, apmAmf: { ...prev.testing.apmAmf, batteryVolts: e.target.value } } }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-mono"
                    placeholder="24 V"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Engine Speed (RPM)</label>
                  <input
                    type="text"
                    value={reportData.testing.apmAmf.engineSpeed}
                    onChange={e => setReportData(prev => ({ ...prev, testing: { ...prev.testing, apmAmf: { ...prev.testing.apmAmf, engineSpeed: e.target.value } } }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-mono"
                    placeholder="1500 RPM"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Running Hours (Jam)</label>
                  <input
                    type="text"
                    value={reportData.testing.apmAmf.runningHours}
                    onChange={e => setReportData(prev => ({ ...prev, testing: { ...prev.testing, apmAmf: { ...prev.testing.apmAmf, runningHours: e.target.value } } }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-mono"
                    placeholder="0 hrs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Analysis & Remark */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Analysis &amp; Remarks</h3>
            <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-2xl text-xs shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isNormal}
                  onChange={e => setReportData(prev => ({ ...prev, analysis: { ...prev.analysis, isNormal: e.target.checked } }))}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span className="font-bold text-emerald-400">Normal Operation</span>
              </label>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Catatan Keseluruhan (Remark)</label>
                <textarea
                  value={reportData.analysis.remarkText}
                  onChange={e => setReportData(prev => ({ ...prev, analysis: { ...prev.analysis, remarkText: e.target.value } }))}
                  rows={4}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Customer Info */}
        {activeTab === 'customer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Company Name</label>
              <input type="text" value={customerInfo.companyName} onChange={e => updateCustomerInfo('companyName', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Equipment Name</label>
              <input type="text" value={customerInfo.equipmentName} onChange={e => updateCustomerInfo('equipmentName', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Product Name</label>
              <input type="text" value={customerInfo.productName} onChange={e => updateCustomerInfo('productName', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">MOP No.</label>
              <input type="text" value={customerInfo.mopNo} onChange={e => updateCustomerInfo('mopNo', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-amber-600 font-mono" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Engineer</label>
              <input type="text" value={customerInfo.engineer} onChange={e => updateCustomerInfo('engineer', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
          </div>
        )}

        {/* Tab 7: Time Spent */}
        {activeTab === 'time' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Date</label>
              <input type="date" value={timeSpent.date} onChange={e => updateTimeSpent('date', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Departure</label>
              <input type="text" value={timeSpent.departure} onChange={e => updateTimeSpent('departure', e.target.value)} placeholder="08:00" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Start</label>
              <input type="text" value={timeSpent.start} onChange={e => updateTimeSpent('start', e.target.value)} placeholder="09:00" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Finish</label>
              <input type="text" value={timeSpent.finish} onChange={e => updateTimeSpent('finish', e.target.value)} placeholder="17:00" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900" />
            </div>
          </div>
        )}

        {/* Tab 8: Photos */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Dokumentasi Foto Tersinkronisasi ({photos.length})</h3>
            {photos.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada foto yang disinkronisasi dari kartu di atas.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {photos.map(p => (
                  <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative">
                      <img src={p.preview} alt={p.label} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPreviewImage(p.preview)}
                        className="absolute bottom-2 right-2 p-1.5 bg-black/60 rounded-lg text-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-white truncate">{p.label}</p>
                    {p.parameter && (
                      <p className="text-[10px] font-mono text-emerald-400 truncate">{p.parameter}</p>
                    )}
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
            onClick={() => generateGeneratorReportPDF(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.preview, description: p.label })))}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <FileType className="w-4 h-4" />
            GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
