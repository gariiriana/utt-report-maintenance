import { useState, useEffect } from 'react';
import { Eye, Zap, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { generateCTReportPDF } from '@/service_reports/ct/generateCTReportPDF';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/api/firebase';
import {
  CTCustomerInfo,
  CTReportData,
  CTTimeSpent,
  DEFAULT_CT_CUSTOMER_INFO,
  DEFAULT_CT_REPORT_DATA,
  DEFAULT_CT_TIME_SPENT,
  CTInspectionItem,
  CTCleaningItem,
} from '@/types/ctReportTypes';

interface UploadedPhoto {
  id: string;
  preview: string;
  label: string;
  parameter?: string;
}

interface CTServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: CTCustomerInfo; reportData: CTReportData; timeSpent: CTTimeSpent }) => void;
}

export function CTServiceReport({ prefillData, onClearPrefill, onChange }: CTServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<CTCustomerInfo>(DEFAULT_CT_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<CTReportData>(DEFAULT_CT_REPORT_DATA);
  const [timeSpent, setTimeSpent] = useState<CTTimeSpent>(DEFAULT_CT_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'customer' | 'photos' | 'inspection' | 'cleaning' | 'measurement' | 'analysis' | 'time'>('inspection');
  const [_isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiLimit, setAiLimit] = useState<{ total: number; used: number } | null>(null);

  // Sync state with parent onChange
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  // Listen to global AI limit tracker in Firestore
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

  // Load from prefill or sinkronisasi
  useEffect(() => {
    if (prefillData) {
      let mappedPhotos: UploadedPhoto[] = [];
      if (prefillData.photos) {
        mappedPhotos = prefillData.photos.map((p: any, i: number) => ({
          id: `ct-p-${i}-${Date.now()}`,
          preview: p.preview || p.base64 || '',
          label: p.description || p.label || `Foto #${i + 1}`,
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.ctCustomerInfo) {
        setCustomerInfo(prefillData.ctCustomerInfo);
      } else {
        setCustomerInfo(prev => ({
          ...prev,
          location: prefillData.specificDetail || prev.location,
          date: prefillData.maintenanceTime || prev.date,
        }));
      }
      if (prefillData.ctTimeSpent) {
        setTimeSpent(prefillData.ctTimeSpent);
      }
      if (prefillData.ctReportData) {
        setReportData(prefillData.ctReportData);
      }

      if (prefillData.triggerGenerateData) {
        generateCTReportWithAI(mappedPhotos);
      }

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  const generateCTReportWithAI = async (photoList: UploadedPhoto[]) => {
    const toastId = toast.loading('✨ AI Co-Pilot sedang menganalisis foto & data Cooling Tower (CT)...');
    setIsGeneratingAI(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Autentikasi gagal. Silakan login ulang.');

      const payload = {
        photos: photoList.map(p => ({
          base64: p.preview.includes(',') ? p.preview.split(',')[1] : p.preview,
          label: p.label,
          parameter: p.parameter || '',
          category: 'visual_inspection',
        })),
        existingData: reportData,
      };

      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = apiBaseUrl ? (apiBaseUrl.endsWith('/api') ? `${apiBaseUrl}/ai/ct-report` : `${apiBaseUrl}/api/ai/ct-report`) : '/api/ai/ct-report';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Server error (${res.status})`);
      }

      const data: CTReportData = await res.json();
      setReportData(data);
      toast.success('✨ Berhasil menyusun Laporan Service Cooling Tower (CT)!', { id: toastId });
    } catch (err: any) {
      console.error('CT AI error:', err);
      toast.error('Gagal memproses AI Cooling Tower: ' + (err.message || 'Error server'), { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const updateCTInspectionItem = (index: number, field: keyof CTInspectionItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.visualInspectionCT];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, visualInspectionCT: updated };
    });
  };

  const updatePanelInspectionItem = (index: number, field: keyof CTInspectionItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.visualInspectionPanel];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, visualInspectionPanel: updated };
    });
  };

  const updateCTCleaningItem = (index: number, field: keyof CTCleaningItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.cleaningCT];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cleaningCT: updated };
    });
  };

  const updatePanelCleaningItem = (index: number, field: keyof CTCleaningItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.cleaningPanel];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cleaningPanel: updated };
    });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-sky-100/90 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-sky-900/10 text-slate-800">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-cyan-50 rounded-xl border border-cyan-200">
              <Zap className="w-5 h-5 text-cyan-600" />
            </span>
            Cooling Tower & AC Service Report
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-1 bg-cyan-50 text-cyan-600 text-xs font-bold rounded-lg border border-cyan-200 uppercase tracking-widest">
              SERVICE REPORT — COOLING TOWER (CT)
            </span>
            {aiLimit && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200">
                AI Credits: {aiLimit.total - aiLimit.used} / {aiLimit.total}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-slate-200 mb-6">
        {[
          { id: 'inspection', label: '1. Visual Inspection' },
          { id: 'cleaning', label: '2. Cleaning' },
          { id: 'measurement', label: '3. Measurement' },
          { id: 'analysis', label: '4. Analysis & Remark' },
          { id: 'customer', label: 'Customer Info' },
          { id: 'time', label: 'Time Spent' },
          { id: 'photos', label: `Dokumentasi (${photos.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VISUAL INSPECTION */}
      {activeTab === 'inspection' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              1. Visual and Inspection of Cooling Tower Devices
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3 w-44">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.visualInspectionCT.map((item, idx) => (
                    <tr key={`ct-insp-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-700">{item.activity}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.parameter}
                          onChange={e => updateCTInspectionItem(idx, 'parameter', e.target.value)}
                          placeholder="Nilai..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.condition}
                          onChange={e => updateCTInspectionItem(idx, 'condition', e.target.value as any)}
                          className={`w-full bg-white border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                            item.condition === 'Good' ? 'text-emerald-600' : item.condition === 'Not good' ? 'text-rose-600' : 'text-slate-600'
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
                          onChange={e => updateCTInspectionItem(idx, 'remarks', e.target.value)}
                          placeholder="- "
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              2. Visual and Inspection of Panel Control Devices
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3 w-44">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.visualInspectionPanel.map((item, idx) => (
                    <tr key={`panel-insp-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-700">{item.activity}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.parameter}
                          onChange={e => updatePanelInspectionItem(idx, 'parameter', e.target.value)}
                          placeholder="Nilai..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.condition}
                          onChange={e => updatePanelInspectionItem(idx, 'condition', e.target.value as any)}
                          className={`w-full bg-white border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                            item.condition === 'Good' ? 'text-emerald-600' : item.condition === 'Not good' ? 'text-rose-600' : 'text-slate-600'
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
                          onChange={e => updatePanelInspectionItem(idx, 'remarks', e.target.value)}
                          placeholder="- "
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
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
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              1. Cleaning of Cooling Tower Devices
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3 w-44">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.cleaningCT.map((item, idx) => (
                    <tr key={`ct-clean-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-700">{item.activity}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.parameter}
                          onChange={e => updateCTCleaningItem(idx, 'parameter', e.target.value)}
                          placeholder="Nilai..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.condition}
                          onChange={e => updateCTCleaningItem(idx, 'condition', e.target.value as any)}
                          className={`w-full bg-white border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                            item.condition === 'Good' ? 'text-emerald-600' : item.condition === 'Not good' ? 'text-rose-600' : 'text-slate-600'
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
                          onChange={e => updateCTCleaningItem(idx, 'remarks', e.target.value)}
                          placeholder="- "
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              2. Cleaning of Panel Control
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3 w-40">Parameter</th>
                    <th className="p-3 w-36 text-center">Condition</th>
                    <th className="p-3 w-44">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.cleaningPanel.map((item, idx) => (
                    <tr key={`panel-clean-${idx}`} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-slate-400">{item.no}</td>
                      <td className="p-3 text-slate-700">{item.activity}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.parameter}
                          onChange={e => updatePanelCleaningItem(idx, 'parameter', e.target.value)}
                          placeholder="Nilai..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.condition}
                          onChange={e => updatePanelCleaningItem(idx, 'condition', e.target.value as any)}
                          className={`w-full bg-white border border-slate-200 font-bold rounded-lg p-1.5 outline-none text-center cursor-pointer ${
                            item.condition === 'Good' ? 'text-emerald-600' : item.condition === 'Not good' ? 'text-rose-600' : 'text-slate-600'
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
                          onChange={e => updatePanelCleaningItem(idx, 'remarks', e.target.value)}
                          placeholder="- "
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 outline-none focus:border-cyan-500"
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

      {/* TAB 3: MEASUREMENT */}
      {activeTab === 'measurement' && (
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            Measurement Data & Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">a. Measurement Voltage & Current</h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">R-N (V)</label>
                  <input type="text" value={reportData.measurement.rnVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, rnVoltage: e.target.value } }))} placeholder="220 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">S-N (V)</label>
                  <input type="text" value={reportData.measurement.snVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, snVoltage: e.target.value } }))} placeholder="220 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">T-N (V)</label>
                  <input type="text" value={reportData.measurement.tnVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, tnVoltage: e.target.value } }))} placeholder="220 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">R-S (V)</label>
                  <input type="text" value={reportData.measurement.rsVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, rsVoltage: e.target.value } }))} placeholder="380 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">S-T (V)</label>
                  <input type="text" value={reportData.measurement.stVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, stVoltage: e.target.value } }))} placeholder="380 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">T-R (V)</label>
                  <input type="text" value={reportData.measurement.trVoltage} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, trVoltage: e.target.value } }))} placeholder="380 V" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Current R (A)</label>
                  <input type="text" value={reportData.measurement.rCurrent} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, rCurrent: e.target.value } }))} placeholder="15 A" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Current S (A)</label>
                  <input type="text" value={reportData.measurement.sCurrent} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, sCurrent: e.target.value } }))} placeholder="15 A" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Current T (A)</label>
                  <input type="text" value={reportData.measurement.tCurrent} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, tCurrent: e.target.value } }))} placeholder="15 A" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 text-xs shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">b - f. Temperature, Pressure & Speed</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">b. Temperature (°C)</label>
                  <input type="text" value={reportData.measurement.tempMeasurements} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, tempMeasurements: e.target.value } }))} placeholder="28 °C" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">d. Output Air Flow</label>
                  <input type="text" value={reportData.measurement.outputAirFlow} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, outputAirFlow: e.target.value } }))} placeholder="m³/h" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">c. Suction Pipe (bar)</label>
                  <input type="text" value={reportData.measurement.suctionPressure} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, suctionPressure: e.target.value } }))} placeholder="bar" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">c. Discharge Pipe (bar)</label>
                  <input type="text" value={reportData.measurement.dischargePressure} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, dischargePressure: e.target.value } }))} placeholder="bar" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">e. Fan Motor Temp (°C)</label>
                  <input type="text" value={reportData.measurement.motorTemp} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, motorTemp: e.target.value } }))} placeholder="45 °C" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">f. Fan Speed (RPM)</label>
                  <input type="text" value={reportData.measurement.fanOutdoorRpm} onChange={e => setReportData(p => ({ ...p, measurement: { ...p.measurement, fanOutdoorRpm: e.target.value } }))} placeholder="1450 RPM" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 outline-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANALYSIS & REMARK */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Analysis & Status Remarks
          </h3>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isNormal}
                  onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, isNormal: e.target.checked, isAbnormal: !e.target.checked } }))}
                  className="w-4 h-4 text-cyan-500 rounded border-slate-700 bg-slate-800"
                />
                <span className="font-bold text-emerald-400 text-sm">Normal Operation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis.isAbnormal}
                  onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, isAbnormal: e.target.checked, isNormal: !e.target.checked } }))}
                  className="w-4 h-4 text-rose-500 rounded border-slate-700 bg-slate-800"
                />
                <span className="font-bold text-rose-400 text-sm">Abnormal Operation</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Remark / Catatan Tambahan</label>
              <textarea
                rows={3}
                value={reportData.analysis.remark}
                onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, remark: e.target.value } }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-cyan-500"
                placeholder="Catatan analisis operasi..."
              />
            </div>

            {reportData.analysis.isAbnormal && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Fault Symptom</label>
                  <input type="text" value={reportData.analysis.faultSymptom} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultSymptom: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Fault Analysis</label>
                  <input type="text" value={reportData.analysis.faultAnalysis} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultAnalysis: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Work Done / Action Taken</label>
                  <input type="text" value={reportData.analysis.workDone} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, workDone: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Fault Part SN</label>
                    <input type="text" value={reportData.analysis.faultPartSN} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultPartSN: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Fault Part Name</label>
                    <input type="text" value={reportData.analysis.faultPartName} onChange={e => setReportData(p => ({ ...p, analysis: { ...p.analysis, faultPartName: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
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
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Informasi Pelanggan & Peralatan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Company Name</label>
              <input type="text" value={customerInfo.companyName} onChange={e => setCustomerInfo(p => ({ ...p, companyName: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Equipment Name</label>
              <input type="text" value={customerInfo.equipmentName} onChange={e => setCustomerInfo(p => ({ ...p, equipmentName: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mop No</label>
              <input type="text" value={customerInfo.mopNo} onChange={e => setCustomerInfo(p => ({ ...p, mopNo: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Location / Site</label>
              <input type="text" value={customerInfo.location} onChange={e => setCustomerInfo(p => ({ ...p, location: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Date</label>
              <input type="date" value={customerInfo.date} onChange={e => setCustomerInfo(p => ({ ...p, date: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Engineer</label>
              <input type="text" value={customerInfo.engineer} onChange={e => setCustomerInfo(p => ({ ...p, engineer: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TIME SPENT */}
      {activeTab === 'time' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Waktu Operasional Maintenance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Tanggal</label>
              <input type="date" value={timeSpent.date} onChange={e => setTimeSpent(p => ({ ...p, date: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Departure</label>
              <input type="time" value={timeSpent.departure} onChange={e => setTimeSpent(p => ({ ...p, departure: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Start</label>
              <input type="time" value={timeSpent.start} onChange={e => setTimeSpent(p => ({ ...p, start: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Finish</label>
              <input type="time" value={timeSpent.finish} onChange={e => setTimeSpent(p => ({ ...p, finish: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PHOTOS */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Foto Dokumentasi Terhubung</h3>
          {photos.length === 0 ? (
            <p className="text-slate-400 text-xs">
              Belum ada foto disinkronkan. Klik tombol <span className="font-bold text-slate-200">"SINKRONISASI KE COOLING TOWER"</span> di atas untuk mengimpor foto dari kartu dokumentasi.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map(p => (
                <div key={p.id} className="bg-slate-950 p-2 rounded-xl border border-slate-800 relative group">
                  <img src={p.preview} alt={p.label} className="w-full h-28 object-cover rounded-lg mb-2" />
                  <p className="text-[10px] text-slate-300 font-medium truncate">{p.label}</p>
                  {p.parameter && <p className="text-[9px] text-cyan-400 font-bold">{p.parameter}</p>}
                  <button
                    onClick={() => setPreviewImage(p.preview)}
                    className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
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
        <button
          type="button"
          onClick={() => generateCTReportPDF(customerInfo, reportData, timeSpent, photos.map(p => ({ id: p.id, photoBase64: p.preview, description: p.label })))}
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <FileType className="w-4 h-4" />
          GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
        </button>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
