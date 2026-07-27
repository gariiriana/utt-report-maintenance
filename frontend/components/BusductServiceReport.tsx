import { useState, useEffect } from 'react';
import { Eye, Zap, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  BusductCustomerInfo,
  BusductReportData,
  BusductTimeSpent,
  DEFAULT_BUSDUCT_CUSTOMER_INFO,
  DEFAULT_BUSDUCT_VISUAL_ITEMS,
  DEFAULT_BUSDUCT_CLEANING_ITEMS,
  DEFAULT_BUSDUCT_THERMAL,
  DEFAULT_BUSDUCT_ANALYSIS,
  DEFAULT_BUSDUCT_TIME_SPENT,
} from '@/types/busductReportTypes';
import { generateBusductReportPDF } from '@/service_reports/busduct/generateBusductReportPDF';
import { analyzeBusductReportAI } from '@/utils/aiAgentPipeline';

interface UploadedPhoto {
  id: string;
  base64: string;
  preview: string;
  category: string;
  label: string;
  parameter?: string;
}

interface BusductServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: { customerInfo: BusductCustomerInfo; reportData: BusductReportData; timeSpent: BusductTimeSpent }) => void;
}

export function BusductServiceReport({ prefillData, onClearPrefill, onChange }: BusductServiceReportProps) {
  const [customerInfo, setCustomerInfo] = useState<BusductCustomerInfo>(DEFAULT_BUSDUCT_CUSTOMER_INFO);
  const [reportData, setReportData] = useState<BusductReportData>({
    customerInfo: DEFAULT_BUSDUCT_CUSTOMER_INFO,
    visualInspection: DEFAULT_BUSDUCT_VISUAL_ITEMS,
    cleaning: DEFAULT_BUSDUCT_CLEANING_ITEMS,
    thermal: DEFAULT_BUSDUCT_THERMAL,
    analysis: DEFAULT_BUSDUCT_ANALYSIS,
    timeSpent: DEFAULT_BUSDUCT_TIME_SPENT,
  });
  const [timeSpent, setTimeSpent] = useState<BusductTimeSpent>(DEFAULT_BUSDUCT_TIME_SPENT);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Sync state with parent
  useEffect(() => {
    if (onChange) {
      onChange({ customerInfo, reportData, timeSpent });
    }
  }, [customerInfo, reportData, timeSpent, onChange]);

  // Load from prefill
  useEffect(() => {
    if (prefillData) {
      if (prefillData.customerInfo) setCustomerInfo(prefillData.customerInfo);
      if (prefillData.reportData) setReportData(prefillData.reportData);
      if (prefillData.timeSpent) setTimeSpent(prefillData.timeSpent);
      if (prefillData.photos) {
        const mappedPhotos: UploadedPhoto[] = prefillData.photos.map((p: any, i: number) => ({
          id: `busduct-p-${i}-${Date.now()}`,
          base64: p.base64 || '',
          preview: p.preview || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : ''),
          category: p.category || 'busduct',
          label: p.label || 'Foto Busduct',
          parameter: p.parameter || '',
        }));
        setPhotos(mappedPhotos);
      }
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, onClearPrefill]);


  // AI Auto-Fill Handler
  const handleAIAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      toast.loading('AI Agent sedang menganalisis foto & parameter Panel Busduct...', { id: 'busduct-ai-toast' });
      const photoPayload = photos.map((p) => ({
        base64: p.base64,
        category: p.category,
        label: p.label,
        parameter: p.parameter,
      }));

      const res = await analyzeBusductReportAI(photoPayload, reportData);
      if (res) {
        toast.success('Analisis AI Busduct selesai! Form terisi otomatis.', { id: 'busduct-ai-toast' });
      }
    } catch (err: any) {
      console.error('Busduct AI analysis error', err);
      toast.error(`AI Analysis Error: ${err.message || 'Gagal menganalisis'}`, { id: 'busduct-ai-toast' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      toast.loading('Generating PDF Busduct Service Report...', { id: 'busduct-pdf-toast' });
      await generateBusductReportPDF(
        customerInfo,
        reportData,
        timeSpent,
        photos.map((p) => ({ photoBase64: p.base64, description: p.label || 'Foto Dokumen Busduct' }))
      );
      toast.success('PDF Service Report Busduct berhasil dibuat!', { id: 'busduct-pdf-toast' });
    } catch (err: any) {
      console.error('PDF export error', err);
      toast.error(`Gagal membuat PDF: ${err.message}`, { id: 'busduct-pdf-toast' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-900/60 to-slate-800 p-6 rounded-lg border border-blue-500/30">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white tracking-wide">SERVICE REPORT PANEL BUSDUCT</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">PT. DWI MITRA EKATAMA MANDIRI — NeutraDC Cikarang</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            {isAnalyzing ? 'Menganalisis...' : 'Analisis AI Auto-Fill'}
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
          >
            <Eye className="w-4 h-4" />
            Preview & Download PDF
          </button>
        </div>
      </div>

      {/* Customer Info Form */}
      <div className="bg-slate-800/60 p-5 rounded-lg border border-slate-700/60 space-y-4">
        <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Informasi Customer & Equipment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-slate-400">Company Name</label>
            <input
              type="text"
              value={customerInfo.companyName}
              onChange={(e) => setCustomerInfo({ ...customerInfo, companyName: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400">Equipment Name</label>
            <input
              type="text"
              value={customerInfo.equipmentName}
              onChange={(e) => setCustomerInfo({ ...customerInfo, equipmentName: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400">Type</label>
            <input
              type="text"
              value={customerInfo.type}
              onChange={(e) => setCustomerInfo({ ...customerInfo, type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400">Specification</label>
            <input
              type="text"
              value={customerInfo.specification}
              onChange={(e) => setCustomerInfo({ ...customerInfo, specification: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400">Serial No</label>
            <input
              type="text"
              value={customerInfo.serialNo}
              onChange={(e) => setCustomerInfo({ ...customerInfo, serialNo: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400">MOP No</label>
            <input
              type="text"
              value={customerInfo.mopNo}
              onChange={(e) => setCustomerInfo({ ...customerInfo, mopNo: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Visual Inspection Table */}
      <div className="bg-slate-800/60 p-5 rounded-lg border border-slate-700/60 space-y-3">
        <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Visual Inspection & Maintenance (10 Items)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
                <th className="p-2 w-12 text-center">No</th>
                <th className="p-2">Activity</th>
                <th className="p-2">Parameter</th>
                <th className="p-2 w-24 text-center">Condition</th>
                <th className="p-2">Remarks (2-5 Kata)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.visualInspection.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="p-2 text-center font-mono text-slate-400">{item.no}</td>
                  <td className="p-2 text-slate-200">{item.activity}</td>
                  <td className="p-2 text-slate-400">{item.parameter}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => {
                        const updated = [...reportData.visualInspection];
                        updated[idx].isGood = !updated[idx].isGood;
                        updated[idx].isNotGood = !updated[idx].isGood;
                        setReportData({ ...reportData, visualInspection: updated });
                      }}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.isGood ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {item.isGood ? 'Good ✓' : 'Not Good ✗'}
                    </button>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => {
                        const updated = [...reportData.visualInspection];
                        updated[idx].remarks = e.target.value;
                        setReportData({ ...reportData, visualInspection: updated });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cleaning Table */}
      <div className="bg-slate-800/60 p-5 rounded-lg border border-slate-700/60 space-y-3">
        <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Cleaning & Maintenance (2 Items)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
                <th className="p-2 w-12 text-center">No</th>
                <th className="p-2">Activity</th>
                <th className="p-2">Parameter</th>
                <th className="p-2 w-24 text-center">Condition</th>
                <th className="p-2">Remarks (2-5 Kata)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.cleaning.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="p-2 text-center font-mono text-slate-400">{item.no}</td>
                  <td className="p-2 text-slate-200">{item.activity}</td>
                  <td className="p-2 text-slate-400">{item.parameter}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => {
                        const updated = [...reportData.cleaning];
                        updated[idx].isGood = !updated[idx].isGood;
                        updated[idx].isNotGood = !updated[idx].isGood;
                        setReportData({ ...reportData, cleaning: updated });
                      }}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.isGood ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {item.isGood ? 'Good ✓' : 'Not Good ✗'}
                    </button>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => {
                        const updated = [...reportData.cleaning];
                        updated[idx].remarks = e.target.value;
                        setReportData({ ...reportData, cleaning: updated });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Measurement */}
      <div className="bg-slate-800/60 p-5 rounded-lg border border-slate-700/60 space-y-3">
        <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Thermal Measurement Joint
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400">Breaker / Joint</label>
            <input
              type="text"
              value={reportData.thermal.breaker}
              onChange={(e) => setReportData({ ...reportData, thermal: { ...reportData.thermal, breaker: e.target.value } })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
            />
          </div>
          <div>
            <label className="text-slate-400">Result Temp Joint (°C)</label>
            <input
              type="text"
              value={reportData.thermal.resultTemp}
              onChange={(e) => setReportData({ ...reportData, thermal: { ...reportData.thermal, resultTemp: e.target.value } })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
            />
          </div>
          <div>
            <label className="text-slate-400">Standard</label>
            <input
              type="text"
              disabled
              value={reportData.thermal.standard}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-400 mt-1"
            />
          </div>
          <div>
            <label className="text-slate-400">Remarks</label>
            <input
              type="text"
              value={reportData.thermal.remarks}
              onChange={(e) => setReportData({ ...reportData, thermal: { ...reportData.thermal, remarks: e.target.value } })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
