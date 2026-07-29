import React, { useState, useEffect } from 'react';
import {
  CapacitorbankCustomerInfo,
  CapacitorbankReportData,
  CapacitorbankTimeSpent,
  DEFAULT_CAPACITORBANK_CUSTOMER_INFO,
  DEFAULT_CAPACITORBANK_VISUAL_ITEMS,
  DEFAULT_CAPACITORBANK_CLEANING_ITEMS,
  DEFAULT_CAPACITORBANK_VOLTAGE_AMPERE,
  DEFAULT_CAPACITORBANK_THERMAL,
  DEFAULT_CAPACITORBANK_GROUNDING,
  DEFAULT_CAPACITORBANK_CAPACITANCE,
  DEFAULT_CAPACITORBANK_ANALYSIS,
  DEFAULT_CAPACITORBANK_TIME_SPENT,
} from '@/types/capacitorbankReportTypes';
import { generateCapacitorbankReportPDF } from '@/service_reports/capacitorbank/generateCapacitorbankReportPDF';
import { generateCapacitorbankReportExcel } from '@/service_reports/capacitorbank/generateCapacitorbankReportExcel';
import { Download, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

interface CapacitorbankServiceReportProps {
  prefillData?: any;
  onClearPrefill?: () => void;
  onChange?: (data: CapacitorbankReportData) => void;
}

export const CapacitorbankServiceReport: React.FC<CapacitorbankServiceReportProps> = ({
  prefillData,
  onClearPrefill,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<string>('visual');

  const [customerInfo, setCustomerInfo] = useState<CapacitorbankCustomerInfo>(DEFAULT_CAPACITORBANK_CUSTOMER_INFO);
  const [visualInspection, setVisualInspection] = useState(DEFAULT_CAPACITORBANK_VISUAL_ITEMS);
  const [cleaning, setCleaning] = useState(DEFAULT_CAPACITORBANK_CLEANING_ITEMS);
  const [voltageAmpere, setVoltageAmpere] = useState(DEFAULT_CAPACITORBANK_VOLTAGE_AMPERE);
  const [thermal, setThermal] = useState(DEFAULT_CAPACITORBANK_THERMAL);
  const [grounding, setGrounding] = useState(DEFAULT_CAPACITORBANK_GROUNDING);
  const [capacitance, setCapacitance] = useState(DEFAULT_CAPACITORBANK_CAPACITANCE);
  const [analysis, setAnalysis] = useState(DEFAULT_CAPACITORBANK_ANALYSIS);
  const [timeSpent, setTimeSpent] = useState<CapacitorbankTimeSpent>(DEFAULT_CAPACITORBANK_TIME_SPENT);
  const [photos, setPhotos] = useState<Array<{ base64: string; label: string }>>([]);

  // Sync to parent component
  useEffect(() => {
    if (onChange) {
      onChange({
        customerInfo,
        visualInspection,
        cleaning,
        voltageAmpere,
        thermal,
        grounding,
        capacitance,
        analysis,
        timeSpent,
      });
    }
  }, [customerInfo, visualInspection, cleaning, voltageAmpere, thermal, grounding, capacitance, analysis, timeSpent]);

  // Handle prefill data from AI / Archive
  useEffect(() => {
    if (prefillData) {
      if (prefillData.customerInfo) setCustomerInfo((prev) => ({ ...prev, ...prefillData.customerInfo }));
      if (prefillData.reportData) {
        const rd = prefillData.reportData;
        if (rd.visualInspection) setVisualInspection(rd.visualInspection);
        if (rd.cleaning) setCleaning(rd.cleaning);
        if (rd.voltageAmpere) setVoltageAmpere(rd.voltageAmpere);
        if (rd.thermal) setThermal(rd.thermal);
        if (rd.grounding) setGrounding(rd.grounding);
        if (rd.capacitance) setCapacitance(rd.capacitance);
        if (rd.analysis) setAnalysis(rd.analysis);
      }
      if (prefillData.timeSpent) setTimeSpent((prev) => ({ ...prev, ...prefillData.timeSpent }));
      if (prefillData.photos) {
        setPhotos(prefillData.photos);

        // Auto parse measurement parameters from photo cards when synced
        prefillData.photos.forEach((p: any) => {
          const label = (p.label || p.description || '').toLowerCase();
          const param = (p.parameter || '').trim();
          if (!param) return;

          if (label.includes('phase-to-phase') || label.includes('fasa-fasa') || label.includes('r-s')) {
            const vals = param.replace(/[^0-9.,]/g, ' ').trim().split(/[\s,]+/);
            if (vals[0]) setVoltageAmpere(prev => ({ ...prev, voltageRS: vals[0] }));
            if (vals[1]) setVoltageAmpere(prev => ({ ...prev, voltageST: vals[1] }));
            if (vals[2]) setVoltageAmpere(prev => ({ ...prev, voltageTR: vals[2] }));
          } else if (label.includes('phase-to-neutral') || label.includes('fasa-netral') || label.includes('r-n')) {
            const vals = param.replace(/[^0-9.,]/g, ' ').trim().split(/[\s,]+/);
            if (vals[0]) setVoltageAmpere(prev => ({ ...prev, voltageRN: vals[0] }));
            if (vals[1]) setVoltageAmpere(prev => ({ ...prev, voltageSN: vals[1] }));
            if (vals[2]) setVoltageAmpere(prev => ({ ...prev, voltageTN: vals[2] }));
            if (vals[3]) setVoltageAmpere(prev => ({ ...prev, voltageNG: vals[3] }));
          } else if (label.includes('current') || label.includes('ampere') || label.includes('arus')) {
            const vals = param.replace(/[^0-9.,]/g, ' ').trim().split(/[\s,]+/);
            if (vals[0]) setVoltageAmpere(prev => ({ ...prev, ampereR: vals[0] }));
            if (vals[1]) setVoltageAmpere(prev => ({ ...prev, ampereS: vals[1] }));
            if (vals[2]) setVoltageAmpere(prev => ({ ...prev, ampereT: vals[2] }));
            if (vals[3]) setVoltageAmpere(prev => ({ ...prev, ampereN: vals[3] }));
          } else if (label.includes('thermal') || label.includes('suhu') || label.includes('breaker')) {
            const match = param.match(/([0-9.]+)/);
            if (match) setThermal(prev => ({ ...prev, breakerResult: match[1] }));
          } else if (label.includes('grounding') || label.includes('tahanan')) {
            const match = param.match(/([0-9.]+)/);
            if (match) setGrounding(prev => ({ ...prev, groundingResult: match[1] }));
          } else if (label.includes('capacitance') || label.includes('kapasitansi') || label.includes('uf')) {
            const match = param.match(/([0-9.]+)/);
            if (match) setCapacitance(prev => ({ ...prev, capacitanceResult: match[1] }));
          }
        });
      }
    }
  }, [prefillData]);

  const handleDownloadPDF = async () => {
    await generateCapacitorbankReportPDF(
      customerInfo,
      { customerInfo, visualInspection, cleaning, voltageAmpere, thermal, grounding, capacitance, analysis, timeSpent },
      timeSpent,
      photos.map((p) => ({ photoBase64: p.base64, description: p.label }))
    );
  };

  const handleVisualChange = (index: number, field: string, val: any) => {
    const updated = [...visualInspection];
    if (field === 'isGood') {
      updated[index].isGood = val;
      if (val) { updated[index].isNotGood = false; updated[index].isNA = false; }
    } else if (field === 'isNotGood') {
      updated[index].isNotGood = val;
      if (val) { updated[index].isGood = false; updated[index].isNA = false; }
    } else if (field === 'isNA') {
      updated[index].isNA = val;
      if (val) { updated[index].isGood = false; updated[index].isNotGood = false; }
    } else if (field === 'remarks') {
      updated[index].remarks = val;
    }
    setVisualInspection(updated);
  };

  const handleCleaningChange = (index: number, field: string, val: any) => {
    const updated = [...cleaning];
    if (field === 'isGood') {
      updated[index].isGood = val;
      if (val) { updated[index].isNotGood = false; updated[index].isNA = false; }
    } else if (field === 'isNotGood') {
      updated[index].isNotGood = val;
      if (val) { updated[index].isGood = false; updated[index].isNA = false; }
    } else if (field === 'isNA') {
      updated[index].isNA = val;
      if (val) { updated[index].isGood = false; updated[index].isNotGood = false; }
    } else if (field === 'remarks') {
      updated[index].remarks = val;
    }
    setCleaning(updated);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-slate-800">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 backdrop-blur-md rounded-full text-blue-200 text-xs font-semibold mb-3 border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Service Report Form
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              PANEL APFCR / CAPACITOR BANK
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              PT. DWI MITRA EKATAMA MANDIRI — Data Center Maintenance Reporting
            </p>
          </div>
          {prefillData && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearPrefill}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Prefill
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 mt-6 overflow-x-auto pb-1 scrollbar-none border-b border-slate-700/50">
          {[
            { id: 'visual', label: '1. Visual Inspection (11)' },
            { id: 'cleaning', label: '2. Cleaning (5)' },
            { id: 'measurements', label: '3. Voltage & Ampere' },
            { id: 'thermal', label: '4. Thermal' },
            { id: 'grounding', label: '5. Grounding & Capacitance' },
            { id: 'analysis', label: '6. Analysis' },
            { id: 'info', label: 'Customer Info' },
            { id: 'time', label: 'Time Spent' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-blue-900 shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Tab 1: Visual Inspection */}
        {activeTab === 'visual' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              1. Visual Inspection & Maintenance (11 Items)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Parameter</th>
                    <th className="p-3 w-44 text-center">Condition</th>
                    <th className="p-3 w-48">Remarks (2-5 kata)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visualInspection.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-center text-slate-500">{item.no}</td>
                      <td className="p-3 font-medium text-slate-800">{item.activity}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">{item.parameter}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isGood}
                              onChange={(e) => handleVisualChange(idx, 'isGood', e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-[11px] font-semibold text-emerald-700">Good</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isNotGood}
                              onChange={(e) => handleVisualChange(idx, 'isNotGood', e.target.checked)}
                              className="w-3.5 h-3.5 text-rose-600 rounded focus:ring-rose-500"
                            />
                            <span className="text-[11px] font-semibold text-rose-700">Not Good</span>
                          </label>
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handleVisualChange(idx, 'remarks', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:bg-white focus:border-blue-500"
                          placeholder="Remark singkat..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Cleaning */}
        {activeTab === 'cleaning' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              2. Cleaning (5 Items)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Parameter</th>
                    <th className="p-3 w-44 text-center">Condition</th>
                    <th className="p-3 w-48">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cleaning.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-center text-slate-500">{item.no}</td>
                      <td className="p-3 font-medium text-slate-800">{item.activity}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">{item.parameter}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isGood}
                              onChange={(e) => handleCleaningChange(idx, 'isGood', e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-[11px] font-semibold text-emerald-700">Good</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isNotGood}
                              onChange={(e) => handleCleaningChange(idx, 'isNotGood', e.target.checked)}
                              className="w-3.5 h-3.5 text-rose-600 rounded focus:ring-rose-500"
                            />
                            <span className="text-[11px] font-semibold text-rose-700">Not Good</span>
                          </label>
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handleCleaningChange(idx, 'remarks', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:bg-white focus:border-blue-500"
                          placeholder="Remark singkat..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Voltage & Ampere */}
        {activeTab === 'measurements' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              3. Voltage & Ampere Measurement
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/60 p-6 rounded-2xl border border-slate-200">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Phase-to-Phase Voltage (V)</h4>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">R - S</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageRS}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageRS: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="395 V"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">S - T</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageST}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageST: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="396 V"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">T - R</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageTR}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageTR: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="395 V"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Phase-to-Neutral Voltage (V)</h4>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">R - N</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageRN}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageRN: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="228 V"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">S - N</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageSN}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageSN: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="229 V"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">T - N</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageTN}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageTN: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="228 V"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">N - G</label>
                  <input
                    type="text"
                    value={voltageAmpere.voltageNG}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, voltageNG: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="1.2 V"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Current / Ampere (A)</h4>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Ampere R</label>
                  <input
                    type="text"
                    value={voltageAmpere.ampereR}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, ampereR: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="42.5 A"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Ampere S</label>
                  <input
                    type="text"
                    value={voltageAmpere.ampereS}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, ampereS: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="43.1 A"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Ampere T</label>
                  <input
                    type="text"
                    value={voltageAmpere.ampereT}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, ampereT: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="42.0 A"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Ampere N</label>
                  <input
                    type="text"
                    value={voltageAmpere.ampereN}
                    onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, ampereN: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-blue-500"
                    placeholder="0.4 A"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Standard</label>
                <input
                  type="text"
                  value={voltageAmpere.standard}
                  onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, standard: e.target.value }))}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={voltageAmpere.remarks}
                  onChange={(e) => setVoltageAmpere((prev) => ({ ...prev, remarks: e.target.value }))}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800"
                  placeholder="Kondisi normal..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Thermal */}
        {activeTab === 'thermal' && (
          <div className="space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              4. Thermal Measurement
            </h3>
            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200/80 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800">Result Temperature (°C)</label>
                <input
                  type="text"
                  value={thermal.breakerResult}
                  onChange={(e) => setThermal((prev) => ({ ...prev, breakerResult: e.target.value }))}
                  className="w-full mt-1.5 bg-white border border-amber-200 rounded-xl p-3 text-sm font-bold font-mono text-slate-900 outline-none focus:border-amber-500"
                  placeholder="34.2 °C"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-800">Standard</label>
                <input
                  type="text"
                  value={thermal.standard}
                  onChange={(e) => setThermal((prev) => ({ ...prev, standard: e.target.value }))}
                  className="w-full mt-1.5 bg-white border border-amber-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-800">Remarks</label>
                <input
                  type="text"
                  value={thermal.remarks}
                  onChange={(e) => setThermal((prev) => ({ ...prev, remarks: e.target.value }))}
                  className="w-full mt-1.5 bg-white border border-amber-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                  placeholder="Suhu aman & teratur..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Grounding & Capacitance */}
        {activeTab === 'grounding' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                5. Grounding Resistance Measurement
              </h3>
              <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">Result (Ω)</label>
                  <input
                    type="text"
                    value={grounding.groundingResult}
                    onChange={(e) => setGrounding((prev) => ({ ...prev, groundingResult: e.target.value }))}
                    className="w-full mt-1 bg-white border border-emerald-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900"
                    placeholder="0.38 Ω"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">Standard</label>
                  <input
                    type="text"
                    value={grounding.standard}
                    onChange={(e) => setGrounding((prev) => ({ ...prev, standard: e.target.value }))}
                    className="w-full mt-1 bg-white border border-emerald-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">Remarks</label>
                  <input
                    type="text"
                    value={grounding.remarks}
                    onChange={(e) => setGrounding((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="w-full mt-1 bg-white border border-emerald-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Capacitance Measurement
              </h3>
              <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">Result (uF)</label>
                  <input
                    type="text"
                    value={capacitance.capacitanceResult}
                    onChange={(e) => setCapacitance((prev) => ({ ...prev, capacitanceResult: e.target.value }))}
                    className="w-full mt-1 bg-white border border-indigo-200 rounded-xl p-2.5 text-xs font-bold font-mono text-slate-900"
                    placeholder="48.5 uF"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">Standard</label>
                  <input
                    type="text"
                    value={capacitance.standard}
                    onChange={(e) => setCapacitance((prev) => ({ ...prev, standard: e.target.value }))}
                    className="w-full mt-1 bg-white border border-indigo-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">Remarks</label>
                  <input
                    type="text"
                    value={capacitance.remarks}
                    onChange={(e) => setCapacitance((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="w-full mt-1 bg-white border border-indigo-200 rounded-xl p-2.5 text-xs font-medium text-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Analysis / Remark */}
        {activeTab === 'analysis' && (
          <div className="space-y-6 max-w-3xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              6. Analysis / Remark
            </h3>
            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-900">Normal Operation Remark</label>
                <textarea
                  rows={2}
                  value={analysis.remark}
                  onChange={(e) => setAnalysis((prev) => ({ ...prev, remark: e.target.value }))}
                  className="w-full mt-1.5 bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  placeholder="Kondisi pengoperasian normal..."
                />
              </div>

              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">Abnormal Operation Detail (If Any)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Fault Symptom</label>
                    <input
                      type="text"
                      value={analysis.faultSymptom}
                      onChange={(e) => setAnalysis((prev) => ({ ...prev, faultSymptom: e.target.value }))}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Fault Analysis</label>
                    <input
                      type="text"
                      value={analysis.faultAnalysis}
                      onChange={(e) => setAnalysis((prev) => ({ ...prev, faultAnalysis: e.target.value }))}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Work Done / Action Taken</label>
                    <input
                      type="text"
                      value={analysis.workDone}
                      onChange={(e) => setAnalysis((prev) => ({ ...prev, workDone: e.target.value }))}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Fault Part Serial No.</label>
                    <input
                      type="text"
                      value={analysis.faultPartSN}
                      onChange={(e) => setAnalysis((prev) => ({ ...prev, faultPartSN: e.target.value }))}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Customer Info */}
        {activeTab === 'info' && (
          <div className="space-y-4 max-w-5xl">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Customer Information Header</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700">Company Name</label>
                <input
                  type="text"
                  value={customerInfo.companyName}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, companyName: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Equipment Name</label>
                <input
                  type="text"
                  value={customerInfo.equipmentName}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, equipmentName: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">CI Description</label>
                <input
                  type="text"
                  value={customerInfo.ciDescription}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, ciDescription: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">CI Name</label>
                <input
                  type="text"
                  value={customerInfo.ciName}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, ciName: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="Utility Panel APFCR"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Type</label>
                <input
                  type="text"
                  value={customerInfo.type}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="APFCR 400kVAR"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Serial No.</label>
                <input
                  type="text"
                  value={customerInfo.serialNo}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, serialNo: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Product Name</label>
                <input
                  type="text"
                  value={customerInfo.productName}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, productName: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Prod. Year</label>
                <input
                  type="text"
                  value={customerInfo.productYears}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, productYears: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="2023"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Specification</label>
                <input
                  type="text"
                  value={customerInfo.specification}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, specification: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-700">MOP No. (Template)</label>
                <input
                  type="text"
                  value={customerInfo.mopNo}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, mopNo: e.target.value }))}
                  className="w-full mt-1 bg-blue-50/80 border border-blue-300 rounded-xl p-2.5 text-xs font-bold text-blue-900"
                  placeholder="DME-TDE/MOP/APCR/03 1206/26"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Quarter</label>
                <select
                  value={customerInfo.quarter}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, quarter: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none"
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Location</label>
                <input
                  type="text"
                  value={customerInfo.location}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="Utility Building"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Area</label>
                <input
                  type="text"
                  value={customerInfo.area}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, area: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="Panel Room"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  value={customerInfo.date}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Engineer</label>
                <input
                  type="text"
                  value={customerInfo.engineer}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, engineer: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                  placeholder="Nama Teknisi"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Time Spent */}
        {activeTab === 'time' && (
          <div className="space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Time Spent Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  value={timeSpent.date}
                  onChange={(e) => setTimeSpent((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Departure</label>
                <input
                  type="time"
                  value={timeSpent.departure}
                  onChange={(e) => setTimeSpent((prev) => ({ ...prev, departure: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Start</label>
                <input
                  type="time"
                  value={timeSpent.start}
                  onChange={(e) => setTimeSpent((prev) => ({ ...prev, start: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Finish</label>
                <input
                  type="time"
                  value={timeSpent.finish}
                  onChange={(e) => setTimeSpent((prev) => ({ ...prev, finish: e.target.value }))}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900"
                />
              </div>
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
              onClick={() => generateCapacitorbankReportExcel(
                customerInfo,
                { customerInfo, visualInspection, cleaning, voltageAmpere, thermal, grounding, capacitance, analysis, timeSpent },
                timeSpent,
                photos.map((p) => ({ photoBase64: p.base64, description: p.label }))
              )}
              className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              EXPORT EXCEL
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              GENERATE SERVICE REPORT & DOKUMENTASI (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
