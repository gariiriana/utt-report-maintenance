import { useState, useEffect } from 'react';
import { Eye, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { generatePDUServiceReportPDF } from '@/service_reports/pdu/generatePDUReportPDF';
import { generatePDUReportExcel } from '@/service_reports/pdu/generatePDUReportExcel';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/api/firebase';
import {
  PDUCustomerInfo,
  PDUReportData,
  PDUTimeSpent,
  DEFAULT_PDU_CUSTOMER_INFO,
  DEFAULT_PDU_REPORT_DATA,
  DEFAULT_PDU_TIME_SPENT,
  PDUInspectionItem,
  PDUCleaningItem,
} from '@/types/pduReportTypes';

interface UploadedPhoto {
  id: string;
  preview: string;
  label: string;
  parameter?: string;
}

interface PDUServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: PDUCustomerInfo; reportData: PDUReportData; timeSpent: PDUTimeSpent }) => void;
}

export function PDUServiceReport({ prefillData, onClearPrefill, onChange }: PDUServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<PDUCustomerInfo>(DEFAULT_PDU_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<PDUReportData>(DEFAULT_PDU_REPORT_DATA);
  const [timeSpent, setTimeSpent] = useState<PDUTimeSpent>(DEFAULT_PDU_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'customer' | 'photos' | 'inspection' | 'cleaning' | 'dpm' | 'iso_temp' | 'thermal_grounding' | 'status' | 'time'>('inspection');
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
          id: `pdu-p-${i}-${Date.now()}`,
          preview: p.preview || p.base64 || '',
          label: p.description || p.label || `Foto #${i + 1}`,
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }

      if (prefillData.pduCustomerInfo) {
        setCustomerInfo(prefillData.pduCustomerInfo);
      }
      if (prefillData.pduTimeSpent) {
        setTimeSpent(prefillData.pduTimeSpent);
      }
      if (prefillData.pduReportData) {
        setReportData(prefillData.pduReportData);
      }

      if (prefillData.triggerGenerateData) {
        generatePDUReportWithAI(mappedPhotos);
      }

      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillData, onClearPrefill]);

  const generatePDUReportWithAI = async (photoList: UploadedPhoto[]) => {
    setIsGeneratingAI(true);
    const toastId = toast.loading('✨ AI Co-Pilot sedang menganalisis foto & data PDU...');

    try {
      const token = await auth.currentUser?.getIdToken();
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = apiBaseUrl.endsWith('/api')
        ? `${apiBaseUrl}/ai/pdu-report`
        : `${apiBaseUrl}/api/ai/pdu-report`;

      const payload = {
        photos: photoList.map(p => ({
          category: 'pdu_inspection',
          label: p.label,
          parameter: p.parameter || '',
        })),
        existing_data: reportData,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`AI Request failed with status ${res.status}`);
      }

      const data: PDUReportData = await res.json();
      setReportData(data);
      toast.success('✨ Berhasil menyusun Laporan PDU!', { id: toastId });
    } catch (err: any) {
      console.error('PDU AI error:', err);
      toast.error('Gagal memproses AI PDU: ' + (err.message || 'Error server'), { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const updateInspectionItem = (index: number, field: keyof PDUInspectionItem, value: any) => {
    setReportData(prev => {
      const updated = [...prev.inspection_checking];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, inspection_checking: updated };
    });
  };

  const updateCleaningItem = (index: number, field: keyof PDUCleaningItem, value: any) => {
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
                Service Report — Panel PDU (Power Distribution Unit)
              </h1>
              <span className="bg-indigo-100/90 text-indigo-800 text-[10px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-full font-bold border border-indigo-300 shadow-sm">
                Neutra DC Cikarang
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Laporan pemeliharaan rutin Panel PDU (400 A) & Analisis AI Co-Pilot.
            </p>
          </div>
        </div>

        {/* Global AI Limit Tracker Bar */}
        <div className="pt-3 border-t border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-black tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
              🤖 Kuota AI Global
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {aiLimit ? `${(aiLimit.total - aiLimit.used).toLocaleString()} / ${aiLimit.total.toLocaleString()} request tersisa hari ini` : 'Loading kuota...'}
            </span>
          </div>
          <div className="w-full sm:w-48 bg-slate-200 rounded-full h-1.5 overflow-hidden border border-slate-300">
            <div
              className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 transition-all duration-500"
              style={{ width: aiLimit ? `${Math.max(0, 100 - (aiLimit.used / aiLimit.total) * 100)}%` : '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2.5 border-b border-slate-200 text-xs sm:text-sm font-medium -mx-2 px-2 sm:mx-0 sm:px-0">
        {[
          { id: 'customer', label: 'Customer Info' },
          { id: 'photos', label: `Foto Dokumentasi (${photos.length})` },
          { id: 'inspection', label: `Inspection (${reportData.inspection_checking.length})` },
          { id: 'cleaning', label: `Cleaning (${reportData.cleaning.length})` },
          { id: 'dpm', label: 'DPM Recording' },
          { id: 'iso_temp', label: 'ISO-Trans & Measurements' },
          { id: 'thermal_grounding', label: 'Thermal, Grounding & Noise' },
          { id: 'status', label: 'Analysis & Remark' },
          { id: 'time', label: 'Time Spent' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-xs sm:text-sm font-bold cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
                <p className="text-slate-600 text-xs sm:text-sm font-medium">Belum ada foto disinkronkan. Klik tombol <span className="font-bold text-slate-900">"SINKRONISASI KE PDU"</span> di atas untuk mengimpor foto & parameter dari kartu di atas.</p>
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

        {/* 3. INSPECTION / CHECKING */}
        {activeTab === 'inspection' && (
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm text-slate-800 min-w-[620px]">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-44">Parameter</th>
                  <th className="p-3 w-36">Condition</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.inspection_checking.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-center text-slate-500">{item.no}</td>
                    <td className="p-3 font-bold text-slate-900">{item.activity}</td>
                    <td className="p-3 text-slate-600 font-medium">{item.parameter}</td>
                    <td className="p-3">
                      <select
                        value={item.condition}
                        onChange={e => updateInspectionItem(idx, 'condition', e.target.value as any)}
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer shadow-sm ${
                          item.condition === 'Good'
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 font-bold'
                            : 'border-rose-300 bg-rose-50/70 text-rose-800 font-bold'
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
                        onChange={e => updateInspectionItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan / keterangan..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
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
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm text-slate-800 min-w-[620px]">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 w-44">Parameter</th>
                  <th className="p-3 w-36">Condition</th>
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
                      <input
                        type="text"
                        value={item.condition}
                        onChange={e => updateCleaningItem(idx, 'condition', e.target.value)}
                        className="w-full bg-emerald-50/70 border border-emerald-300 rounded-lg px-2 py-1 text-xs text-emerald-800 font-bold focus:outline-none shadow-sm"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateCleaningItem(idx, 'remarks', e.target.value)}
                        placeholder="Catatan / keterangan..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. DIGITAL POWER METER (DPM) RECORDING */}
        {activeTab === 'dpm' && (
          <div className="space-y-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Digital Power Meter Recording</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* Ampere */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-bold text-indigo-700">Current (Ampere)</p>
                  <div><label className="text-slate-700 font-bold">R Ampere</label><input type="text" value={reportData.dpm_recording.r_ampere} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, r_ampere: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">S Ampere</label><input type="text" value={reportData.dpm_recording.s_ampere} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, s_ampere: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">T Ampere</label><input type="text" value={reportData.dpm_recording.t_ampere} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, t_ampere: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">N Ampere</label><input type="text" value={reportData.dpm_recording.n_ampere} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, n_ampere: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                </div>

                {/* Power */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-bold text-emerald-700">Power (Daya)</p>
                  <div><label className="text-slate-700 font-bold">KW</label><input type="text" value={reportData.dpm_recording.kw} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, kw: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">KVA</label><input type="text" value={reportData.dpm_recording.kva} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, kva: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">KVAR</label><input type="text" value={reportData.dpm_recording.kvar} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, kvar: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">Cos p</label><input type="text" value={reportData.dpm_recording.cos_p} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, cos_p: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                </div>

                {/* Line Voltage */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-bold text-amber-700">Line Voltage (L-L)</p>
                  <div><label className="text-slate-700 font-bold">R-S Voltage</label><input type="text" value={reportData.dpm_recording.voltage_rs} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_rs: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">S-T Voltage</label><input type="text" value={reportData.dpm_recording.voltage_st} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_st: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">T-R Voltage</label><input type="text" value={reportData.dpm_recording.voltage_tr} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_tr: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                </div>

                {/* Neutral Voltage */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-bold text-cyan-700">Phase Voltage (L-N)</p>
                  <div><label className="text-slate-700 font-bold">R-N Voltage</label><input type="text" value={reportData.dpm_recording.voltage_rn} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_rn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">S-N Voltage</label><input type="text" value={reportData.dpm_recording.voltage_sn} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_sn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">T-N Voltage</label><input type="text" value={reportData.dpm_recording.voltage_tn} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_tn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                  <div><label className="text-slate-700 font-bold">N-G Voltage</label><input type="text" value={reportData.dpm_recording.voltage_ng} onChange={e => setReportData(prev => ({ ...prev, dpm_recording: { ...prev.dpm_recording, voltage_ng: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. ISO-TRANS & VOLTAGE/AMPERE */}
        {activeTab === 'iso_temp' && (
          <div className="space-y-6">
            {/* ISO-Trans Temperature */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Temperature Monitoring ISO-Trans (&lt; 45 °C)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div><label className="text-slate-700 font-bold mb-1 block">R Temp (°C)</label><input type="text" value={reportData.iso_trans_temp.r_temp} onChange={e => setReportData(prev => ({ ...prev, iso_trans_temp: { ...prev.iso_trans_temp, r_temp: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">S Temp (°C)</label><input type="text" value={reportData.iso_trans_temp.s_temp} onChange={e => setReportData(prev => ({ ...prev, iso_trans_temp: { ...prev.iso_trans_temp, s_temp: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">T Temp (°C)</label><input type="text" value={reportData.iso_trans_temp.t_temp} onChange={e => setReportData(prev => ({ ...prev, iso_trans_temp: { ...prev.iso_trans_temp, t_temp: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
              </div>
            </div>

            {/* Voltage & Ampere Measurement */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Voltage & Ampere Measurement</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div><label className="text-slate-700 font-bold mb-1 block">R-S Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_rs} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_rs: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">S-T Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_st} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_st: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">T-R Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_tr} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_tr: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">R-N Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_rn} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_rn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">S-N Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_sn} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_sn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">T-N Voltage</label><input type="text" value={reportData.voltage_ampere.voltage_tn} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, voltage_tn: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">Current R</label><input type="text" value={reportData.voltage_ampere.current_r} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, current_r: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">Current S</label><input type="text" value={reportData.voltage_ampere.current_s} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, current_s: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
                <div><label className="text-slate-700 font-bold mb-1 block">Current T</label><input type="text" value={reportData.voltage_ampere.current_t} onChange={e => setReportData(prev => ({ ...prev, voltage_ampere: { ...prev.voltage_ampere, current_t: e.target.value } }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium shadow-sm" /></div>
              </div>
            </div>
          </div>
        )}

        {/* 7. THERMAL, GROUNDING & NOISE */}
        {activeTab === 'thermal_grounding' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Thermal */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">Thermal Measurement</h3>
              <div><label className="text-[11px] text-slate-700 font-bold mb-1 block">Main Breaker Temp (°C)</label><input type="text" value={reportData.thermal_measurement.result_temp} onChange={e => setReportData(prev => ({ ...prev, thermal_measurement: { ...prev.thermal_measurement, result_temp: e.target.value } }))} placeholder="Suhu °C..." className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs font-medium shadow-sm" /></div>
              <p className="text-[10px] text-slate-500 font-medium">Standard: &lt; 45 °C</p>
            </div>

            {/* Grounding */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">Grounding Resistance</h3>
              <div><label className="text-[11px] text-slate-700 font-bold mb-1 block">Result (Ω)</label><input type="text" value={reportData.grounding_resistance.result} onChange={e => setReportData(prev => ({ ...prev, grounding_resistance: { ...prev.grounding_resistance, result: e.target.value } }))} placeholder="Nilai Ω..." className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs font-medium shadow-sm" /></div>
              <p className="text-[10px] text-slate-500 font-medium">Standard: &lt; 5 Ω</p>
            </div>

            {/* Noise */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-700">Noise Measurement</h3>
              <div><label className="text-[11px] text-slate-700 font-bold mb-1 block">Result (dB)</label><input type="text" value={reportData.noise_measurement.result} onChange={e => setReportData(prev => ({ ...prev, noise_measurement: { ...prev.noise_measurement, result: e.target.value } }))} placeholder="Nilai dB..." className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs font-medium shadow-sm" /></div>
              <p className="text-[10px] text-slate-500 font-medium">Standard: &lt; 75 dB</p>
            </div>
          </div>
        )}

        {/* 8. ANALYSIS & REMARK */}
        {activeTab === 'status' && (
          <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis_remark.isNormal}
                  onChange={e => setReportData(prev => ({
                    ...prev,
                    analysis_remark: { ...prev.analysis_remark, isNormal: e.target.checked, isAbnormal: !e.target.checked }
                  }))}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-emerald-700">Normal Operation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportData.analysis_remark.isAbnormal}
                  onChange={e => setReportData(prev => ({
                    ...prev,
                    analysis_remark: { ...prev.analysis_remark, isAbnormal: e.target.checked, isNormal: !e.target.checked }
                  }))}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                />
                <span className="text-sm font-bold text-rose-700">Abnormal Operation</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-700 font-bold uppercase tracking-wider block">Remark / Catatan Analisis AI</label>
              <textarea
                rows={4}
                value={reportData.analysis_remark.remarkText}
                onChange={e => setReportData(prev => ({
                  ...prev,
                  analysis_remark: { ...prev.analysis_remark, remarkText: e.target.value }
                }))}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>
          </div>
        )}

        {/* 9. TIME SPENT */}
        {activeTab === 'time' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1 block">Date</label>
              <input type="date" value={timeSpent.date} onChange={e => setTimeSpent(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1 block">Departure</label>
              <input type="time" value={timeSpent.departure} onChange={e => setTimeSpent(prev => ({ ...prev, departure: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1 block">Start</label>
              <input type="time" value={timeSpent.start} onChange={e => setTimeSpent(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1 block">Finish</label>
              <input type="time" value={timeSpent.finish} onChange={e => setTimeSpent(prev => ({ ...prev, finish: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm" />
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
              onClick={() => generatePDUReportExcel(customerInfo, reportData, timeSpent, photos.map(p => ({ photoBase64: p.preview, description: p.label })))}
              className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileType className="w-4 h-4" />
              EXPORT EXCEL
            </button>
            <button
              type="button"
              onClick={() => generatePDUServiceReportPDF(customerInfo, reportData, timeSpent, photos.map(p => ({ id: p.id, photoBase64: p.preview, description: p.label })))}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FileType className="w-4 h-4" />
              GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
