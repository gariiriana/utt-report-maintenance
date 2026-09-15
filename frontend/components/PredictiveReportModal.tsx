// ============================================================================
// FILE: frontend/components/PredictiveReportModal.tsx
// Deskripsi: Modal Interaktif Preview & Penyuntingan Laporan Predictive
//            Maintenance (PdM) Berstandar Keandalan Data Center NeutraDC Cikarang.
//            Mendukung pengeditan 5 section, penambahan/penghapusan parameter drift,
//            manajemen sparepart, re-analisis AI, ekspor resmi Word & PDF, serta
//            penyimpanan sinkron ke Firestore (collection 'predictive_reports').
// ============================================================================

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Sparkles,
  Download,
  FileText,
  Save,
  Wrench,
  Activity,
  ShieldCheck,
  Trash2,
  Plus,
  Loader2,
  Cpu,
  FileCheck,
  Clock
} from 'lucide-react';
import {
  PredictiveReportData,
  PredictiveParameterDrift,
  PredictiveSparepart
} from '@/types/predictiveReportTypes';
import { exportPredictiveReportToDocx } from '@/utils/PredictiveReportWordExport';
import { exportPredictiveReportToPdf } from '@/utils/PredictiveReportPdfExport';
import {
  PREPARED_BY_SIGNATURES,
  getEngineerSignature,
  cleanSignature,
  ARIF_BUDIMAN_SIGNATURE_BASE64,
  ASEP_SIGNATURE_BASE64,
} from '@/utils/engineerSignatures';
import { db } from '@/api/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useModalScrollLock } from '@/utils/modalScrollLock';

interface PredictiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: PredictiveReportData;
  onSaved?: (data: PredictiveReportData) => void;
  onRegenerateAI?: () => Promise<void>;
  isLoadingAI?: boolean;
}

/**
 * Helper: Hapus seluruh key bernilai undefined secara rekursif sebelum dikirim ke Firestore
 * agar tidak melempar error 'Function setDoc() called with invalid data. Unsupported field value: undefined'
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  // Biarkan Date dan Firestore FieldValue / Timestamp apa adanya
  if (obj instanceof Date || (obj.constructor && obj.constructor.name !== 'Object' && !Array.isArray(obj))) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as any;
}

function normalizePredictiveData(input: PredictiveReportData): PredictiveReportData {
  const sig = input.signatures || ({} as any);
  const prepName = sig.preparedBy?.name || 'Asep Mohammad Fauzi';
  return {
    ...input,
    signatures: {
      authorName: sig.authorName || 'Rizki Novri Yanda – Data Center Operation',
      preparedBy: {
        name: prepName,
        title: sig.preparedBy?.title || '(Electrical Engineer)',
        signatureBase64:
          cleanSignature(sig.preparedBy?.signatureBase64) ||
          cleanSignature(PREPARED_BY_SIGNATURES[prepName]) ||
          getEngineerSignature(prepName) ||
          ASEP_SIGNATURE_BASE64,
        date: sig.preparedBy?.date || '',
      },
      reviewedBy: {
        name: 'Arif Budiman',
        title: '(Technical Manager)',
        signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
        date: sig.reviewedBy?.date || '',
      },
      verifiedBy: {
        name: 'Arif Budiman',
        title: '(Technical Manager)',
        signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
        date: sig.verifiedBy?.date || '',
      },
      acknowledgedBy1: {
        name: sig.acknowledgedBy1?.name || 'Habib Mulyana',
        title: sig.acknowledgedBy1?.title || '(Chief Engineer)',
        signatureBase64: cleanSignature(sig.acknowledgedBy1?.signatureBase64) || '',
        date: sig.acknowledgedBy1?.date || '',
      },
      acknowledgedBy2: {
        name: sig.acknowledgedBy2?.name || 'Supriyatno',
        title: sig.acknowledgedBy2?.title || '(Facility manager)',
        signatureBase64: cleanSignature(sig.acknowledgedBy2?.signatureBase64) || '',
        date: sig.acknowledgedBy2?.date || '',
      },
      approvedBy: {
        name: sig.approvedBy?.name || 'Budi Susanto',
        title: sig.approvedBy?.title || '(Assistant manager HDC Facility Management)',
        signatureBase64: cleanSignature(sig.approvedBy?.signatureBase64) || '',
        date: sig.approvedBy?.date || '',
      },
    },
  };
}

export function PredictiveReportModal({
  isOpen,
  onClose,
  initialData,
  onSaved,
  onRegenerateAI,
  isLoadingAI = false
}: PredictiveReportModalProps) {
  const [data, setData] = useState<PredictiveReportData>(() => normalizePredictiveData(initialData));
  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'anomaly' | 'ai' | 'action' | 'approval'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    setData(normalizePredictiveData(initialData));
  }, [initialData]);

  // Kunci scrolling halaman latar belakang saat modal ini terbuka
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  // ─── Handlers untuk Parameter Drift ────────────────────────────────────────

  const handleAddDriftRow = () => {
    const current = data.measuredParameterDrift || [];
    setData({
      ...data,
      measuredParameterDrift: [
        ...current,
        { parameterName: '', measuredValue: '', nominalBaseline: '', unit: '' }
      ]
    });
  };

  const handleUpdateDriftRow = (index: number, field: keyof PredictiveParameterDrift, value: string) => {
    const current = [...(data.measuredParameterDrift || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      setData({ ...data, measuredParameterDrift: current });
    }
  };

  const handleDeleteDriftRow = (index: number) => {
    const current = (data.measuredParameterDrift || []).filter((_, i) => i !== index);
    setData({ ...data, measuredParameterDrift: current });
  };

  // ─── Handlers untuk Sparepart ──────────────────────────────────────────────

  const handleAddSparepartRow = () => {
    const current = data.actionPlan.recommendedSpareparts || [];
    setData({
      ...data,
      actionPlan: {
        ...data.actionPlan,
        recommendedSpareparts: [
          ...current,
          { partName: '', partNumber: '', quantity: '1 Pcs', urgency: 'Ready Stock' }
        ]
      }
    });
  };

  const handleUpdateSparepartRow = (index: number, field: keyof PredictiveSparepart, value: any) => {
    const current = [...(data.actionPlan.recommendedSpareparts || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      setData({
        ...data,
        actionPlan: {
          ...data.actionPlan,
          recommendedSpareparts: current
        }
      });
    }
  };

  const handleDeleteSparepartRow = (index: number) => {
    const current = (data.actionPlan.recommendedSpareparts || []).filter((_, i) => i !== index);
    setData({
      ...data,
      actionPlan: {
        ...data.actionPlan,
        recommendedSpareparts: current
      }
    });
  };

  // ─── Simpan ke Firestore ───────────────────────────────────────────────────

  const handleSaveToFirestore = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Menyimpan Laporan Predictive Maintenance...');

    try {
      const docId = data.id || `PDM_${Date.now()}`;
      const docRef = doc(db, 'predictive_reports', docId);

      const rawPayload = {
        ...data,
        id: docId,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp(),
      };

      const payload = sanitizeForFirestore(rawPayload);

      await setDoc(docRef, payload, { merge: true });

      // Jika ada dokumen asal (Parent doc), update referensinya agar terhubung 1-to-1
      if (data.sourceDocId && data.sourceCollection) {
        try {
          const parentDocRef = doc(db, data.sourceCollection, data.sourceDocId);
          await updateDoc(parentDocRef, sanitizeForFirestore({
            predictiveReportId: docId,
            predictiveReportNumber: data.reportNumber,
            hasPredictiveReport: true,
            predictiveHealthStatus: data.healthStatus,
            predictiveRemainingLife: data.aiAnalysis?.remainingUsefulLife || '',
            predictiveUpdatedAt: serverTimestamp(),
          }));
        } catch (parentErr) {
          console.warn('Parent document update skipped or failed:', parentErr);
        }
      }

      toast.success('Laporan Predictive Maintenance berhasil disimpan & disinkronkan!', { id: toastId });
      if (onSaved) onSaved(data);
    } catch (error: any) {
      console.error('Error saving predictive report:', error);
      toast.error(`Gagal menyimpan laporan: ${error?.message || 'Error tidak diketahui'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Export DOCX & PDF ─────────────────────────────────────────────────────

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      await exportPredictiveReportToDocx(data);
      toast.success('Berkas Word (.docx) Laporan Prediktif berhasil diunduh!');
    } catch (err: any) {
      toast.error(`Gagal export Word: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportPredictiveReportToPdf(data);
    } catch (err: any) {
      toast.error(`Gagal export PDF: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Predictive Maintenance Report (PdM)</h3>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 rounded-full text-2xs font-bold uppercase tracking-wider">
                  AI Agent Powered
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {data.reportNumber} • Ref: {data.sourceTicketNumber || data.sourceMaintenanceName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRegenerateAI && (
              <button
                type="button"
                onClick={onRegenerateAI}
                disabled={isLoadingAI}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Analisis ulang dengan AI Gemini"
              >
                {isLoadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isLoadingAI ? 'Menganalisis...' : 'Re-Generate AI'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'all', label: 'Semua Section' },
            { id: 'asset', label: '1. Identitas Peralatan' },
            { id: 'anomaly', label: '2. Gejala & Parameter' },
            { id: 'ai', label: '3. Analisis Prediktif' },
            { id: 'action', label: '4. Rencana Tindakan' },
            { id: 'approval', label: '5. Pengesahan' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800">
          {/* ─── SECTION 1: Identitas Peralatan ──────────────────────────── */}
          {(activeTab === 'all' || activeTab === 'asset') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  1. Identitas Dokumen & Peralatan (Asset Identification)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Nomor Laporan PdM</label>
                  <input
                    type="text"
                    value={data.reportNumber}
                    onChange={e => setData({ ...data, reportNumber: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Nama Peralatan / Asset</label>
                  <input
                    type="text"
                    value={data.equipmentName}
                    onChange={e => setData({ ...data, equipmentName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Tag Unit / Asset ID</label>
                  <input
                    type="text"
                    value={data.equipmentTag || ''}
                    onChange={e => setData({ ...data, equipmentTag: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Kategori Sistem</label>
                  <select
                    value={data.systemCategory}
                    onChange={e => setData({ ...data, systemCategory: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="Fuel System">Fuel System</option>
                    <option value="HVAC / Cooling">HVAC / Cooling</option>
                    <option value="Electrical Distribution">Electrical Distribution</option>
                    <option value="UPS & Battery">UPS & Battery</option>
                    <option value="Fire Protection">Fire Protection</option>
                    <option value="General Facility">General Facility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Lokasi / Ruangan</label>
                  <input
                    type="text"
                    value={data.locationRoom}
                    onChange={e => setData({ ...data, locationRoom: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Ref. Tiket / Laporan Asal</label>
                  <input
                    type="text"
                    value={data.sourceTicketNumber || data.sourceMaintenanceName}
                    onChange={e => setData({ ...data, sourceTicketNumber: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── SECTION 2: Kondisi Aktual & Gejala Awal ────────────────── */}
          {(activeTab === 'all' || activeTab === 'anomaly') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    2. Kondisi Aktual & Gejala Awal (Anomaly Drift)
                  </h4>
                </div>

                {/* Health Status Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-500">Status Kesehatan:</span>
                  {(['Caution', 'Warning', 'Critical'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setData({ ...data, healthStatus: st })}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold uppercase transition cursor-pointer ${
                        data.healthStatus === st
                          ? st === 'Critical'
                            ? 'bg-red-600 text-white'
                            : st === 'Warning'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold text-xs mb-1">Deskripsi Gejala Kerusakan Terdeteksi</label>
                <textarea
                  rows={2}
                  value={data.currentSymptoms}
                  onChange={e => setData({ ...data, currentSymptoms: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed"
                />
              </div>

              {/* Tabel Parameter Drift */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Tabel Drift Parameter Terukur:</span>
                  <button
                    type="button"
                    onClick={handleAddDriftRow}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 rounded-lg text-2xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tambah Parameter
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Nama Parameter</th>
                        <th className="p-2">Nilai Terukur</th>
                        <th className="p-2">Nominal Baseline</th>
                        <th className="p-2">Satuan</th>
                        <th className="p-2 text-center w-12">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.measuredParameterDrift || []).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.parameterName}
                              onChange={e => handleUpdateDriftRow(idx, 'parameterName', e.target.value)}
                              placeholder="e.g. Suhu Kontak Thermal"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.measuredValue}
                              onChange={e => handleUpdateDriftRow(idx, 'measuredValue', e.target.value)}
                              placeholder="e.g. 58.2"
                              className="w-full px-2 py-1 border border-red-200 text-red-700 font-bold rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.nominalBaseline}
                              onChange={e => handleUpdateDriftRow(idx, 'nominalBaseline', e.target.value)}
                              placeholder="e.g. < 40.0"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.unit || ''}
                              onChange={e => handleUpdateDriftRow(idx, 'unit', e.target.value)}
                              placeholder="e.g. °C"
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteDriftRow(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Foto Bukti Fisik Anomali */}
              {data.photoEvidenceBase64 && (
                <div className="bg-white p-3 border border-slate-200 rounded-xl flex items-center gap-4">
                  <img
                    src={data.photoEvidenceBase64.startsWith('data:image') ? data.photoEvidenceBase64 : `data:image/jpeg;base64,${data.photoEvidenceBase64}`}
                    alt="Foto Anomali"
                    className="w-24 h-20 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-700 block mb-1">Foto Bukti Fisik Terlampir</span>
                    <input
                      type="text"
                      value={data.photoCaption || ''}
                      onChange={e => setData({ ...data, photoCaption: e.target.value })}
                      placeholder="Keterangan foto bukti anomali..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SECTION 3: Analisis Prediktif ───────────────────────── */}
          {(activeTab === 'all' || activeTab === 'ai') && (
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-100 pb-2.5 gap-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    3. Analisis Prediktif (Reliability & Risk Insight)
                  </h4>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                  {/* Tingkat Urgensi */}
                  <div className="flex items-center gap-1.5 bg-white border border-indigo-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                    <span className="text-xs text-indigo-700 font-semibold whitespace-nowrap">Tingkat Urgensi:</span>
                    <select
                      value={data.aiAnalysis.urgencyLevel}
                      onChange={e => setData({
                        ...data,
                        aiAnalysis: { ...data.aiAnalysis, urgencyLevel: e.target.value as any }
                      })}
                      className={`px-2 py-0.5 rounded-lg text-xs font-extrabold outline-none cursor-pointer ${
                        data.aiAnalysis.urgencyLevel === 'Emergency' ? 'bg-red-50 text-red-700 font-black' :
                        data.aiAnalysis.urgencyLevel === 'High' ? 'bg-amber-50 text-amber-800 font-black' :
                        data.aiAnalysis.urgencyLevel === 'Medium' ? 'bg-yellow-50 text-yellow-800 font-bold' :
                        'bg-emerald-50 text-emerald-800 font-bold'
                      }`}
                    >
                      <option value="Emergency">Emergency</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  {/* Estimasi Sisa Umur Pakai (RUL) */}
                  <div className="flex items-center gap-1.5 bg-white border border-red-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-xs text-slate-700 font-semibold whitespace-nowrap" title="Remaining Useful Life">Sisa Umur (RUL):</span>
                    <input
                      type="text"
                      value={data.aiAnalysis.remainingUsefulLife}
                      onChange={e => setData({
                        ...data,
                        aiAnalysis: { ...data.aiAnalysis, remainingUsefulLife: e.target.value }
                      })}
                      className="w-28 sm:w-32 px-2 py-0.5 bg-red-50/70 border border-red-300 text-red-700 font-bold rounded-lg text-xs text-center focus:ring-1 focus:ring-red-400 outline-none"
                      placeholder="14 – 21 Hari"
                      title="Estimasi Sisa Umur Pakai (Remaining Useful Life / RUL)"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Akar Masalah (Root Cause Analysis)</label>
                  <textarea
                    rows={3}
                    value={data.aiAnalysis.rootCauseAnalysis}
                    onChange={e => setData({
                      ...data,
                      aiAnalysis: { ...data.aiAnalysis, rootCauseAnalysis: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Potensi Modus Kegagalan (Potential Failure Mode)</label>
                  <textarea
                    rows={3}
                    value={data.aiAnalysis.potentialFailureMode}
                    onChange={e => setData({
                      ...data,
                      aiAnalysis: { ...data.aiAnalysis, potentialFailureMode: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Pola Laju Degradasi (Degradation Pattern)</label>
                  <textarea
                    rows={3}
                    value={data.aiAnalysis.degradationPattern}
                    onChange={e => setData({
                      ...data,
                      aiAnalysis: { ...data.aiAnalysis, degradationPattern: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Evaluasi Risiko Terhadap SLA NeutraDC (99.982% Uptime)</label>
                  <textarea
                    rows={3}
                    value={data.aiAnalysis.slaRiskAssessment}
                    onChange={e => setData({
                      ...data,
                      aiAnalysis: { ...data.aiAnalysis, slaRiskAssessment: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── SECTION 4: Rencana Tindakan Prediktif ──────────────────── */}
          {(activeTab === 'all' || activeTab === 'action') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  4. Rencana Tindakan Prediktif & Pengadaan Suku Cadang
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tindakan Segera (1 - 7 Hari)</label>
                  <textarea
                    rows={3}
                    value={data.actionPlan.immediateAction}
                    onChange={e => setData({
                      ...data,
                      actionPlan: { ...data.actionPlan, immediateAction: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Rencana Overhaul Definitif (2 - 4 Minggu)</label>
                  <textarea
                    rows={3}
                    value={data.actionPlan.plannedOverhaulAction}
                    onChange={e => setData({
                      ...data,
                      actionPlan: { ...data.actionPlan, plannedOverhaulAction: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Tabel Suku Cadang Kritis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Rekomendasi Suku Cadang Kritis:</span>
                  <button
                    type="button"
                    onClick={handleAddSparepartRow}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-600 border border-emerald-200 rounded-lg text-2xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tambah Suku Cadang
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Nama Sparepart</th>
                        <th className="p-2">Part Number</th>
                        <th className="p-2">Jumlah</th>
                        <th className="p-2">Status Pengadaan</th>
                        <th className="p-2 text-center w-12">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.actionPlan.recommendedSpareparts || []).map((sp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={sp.partName}
                              onChange={e => handleUpdateSparepartRow(idx, 'partName', e.target.value)}
                              placeholder="e.g. Mechanical Seal Kit"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={sp.partNumber || ''}
                              onChange={e => handleUpdateSparepartRow(idx, 'partNumber', e.target.value)}
                              placeholder="e.g. MS-50-P"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={sp.quantity}
                              onChange={e => handleUpdateSparepartRow(idx, 'quantity', e.target.value)}
                              placeholder="1 Set"
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={sp.urgency}
                              onChange={e => handleUpdateSparepartRow(idx, 'urgency', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                            >
                              <option value="Ready Stock">Ready Stock</option>
                              <option value="Indent Procurement">Indent Procurement</option>
                              <option value="Critical Backup">Critical Backup</option>
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSparepartRow(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── SECTION 5: Lembar Pengesahan ──────────────────────────── */}
          {(activeTab === 'all' || activeTab === 'approval') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-slate-700" />
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    5. Lembar Pengesahan Resmi (Approval Sheet)
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Format Standar NeutraDC
                </span>
              </div>

              {/* Author Info */}
              <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Author Dokumen (Dibuat Oleh)
                </label>
                <input
                  type="text"
                  value={data.signatures.authorName || 'Rizki Novri Yanda – Data Center Operation'}
                  onChange={e => setData({
                    ...data,
                    signatures: { ...data.signatures, authorName: e.target.value }
                  })}
                  placeholder="AUTHOR BY, Rizki Novri Yanda – Data Center Operation"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Row 1: PREPARED BY & REVIEWED BY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* PREPARED BY */}
                <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                      1. PREPARED BY (Insinyur Pelaksana)
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      TTD Otomatis
                    </span>
                  </div>
                  <select
                    value={data.signatures.preparedBy.name || 'Asep Mohammad Fauzi'}
                    onChange={e => {
                      const selectedName = e.target.value;
                      const sig =
                        cleanSignature(PREPARED_BY_SIGNATURES[selectedName]) ||
                        getEngineerSignature(selectedName) ||
                        '';
                      setData(prev => ({
                        ...prev,
                        signatures: {
                          ...prev.signatures,
                          preparedBy: {
                            ...prev.signatures.preparedBy,
                            name: selectedName,
                            signatureBase64: sig,
                          },
                        },
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Agil Zakia Rahman">Agil Zakia Rahman</option>
                    <option value="Asep Mohammad Fauzi">Asep Mohammad Fauzi</option>
                    <option value="Nugroho Gilang Ramadhan">Nugroho Gilang Ramadhan</option>
                    <option value="Dison Mintuno Andarbeni">Dison Mintuno Andarbeni</option>
                    <option value="Riyan Bayu Nugroho">Riyan Bayu Nugroho</option>
                  </select>
                  <input
                    type="text"
                    value={data.signatures.preparedBy.title}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        preparedBy: { ...data.signatures.preparedBy, title: e.target.value }
                      }
                    })}
                    placeholder="Jabatan (e.g. (Electrical Engineer))"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                  {data.signatures.preparedBy.signatureBase64 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <img
                        src={data.signatures.preparedBy.signatureBase64}
                        alt="TTD Prepared By"
                        className="h-8 max-w-[120px] object-contain bg-slate-50 border border-slate-200 rounded px-1"
                      />
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        TTD Digital Terhubung
                      </span>
                    </div>
                  )}
                </div>

                {/* REVIEWED BY */}
                <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                      2. REVIEWED BY (Technical Manager)
                    </span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      Wajib / Tetap
                    </span>
                  </div>
                  <input
                    type="text"
                    value="Arif Budiman"
                    readOnly
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 text-slate-800 cursor-not-allowed"
                    title="Reviewer resmi diwajibkan Arif Budiman sebagai Technical Manager"
                  />
                  <input
                    type="text"
                    value="(Technical Manager)"
                    readOnly
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 bg-slate-50 cursor-not-allowed"
                  />
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <img
                      src={ARIF_BUDIMAN_SIGNATURE_BASE64}
                      alt="TTD Arif Budiman"
                      className="h-8 max-w-[120px] object-contain bg-slate-50 border border-slate-200 rounded px-1"
                    />
                    <span className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      TTD Technical Manager
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: ACKNOWLEDGED BY (Habib Mulyana & Supriyatno) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                    ACKNOWLEDGED BY 1 (Chief Engineer)
                  </span>
                  <input
                    type="text"
                    value={data.signatures.acknowledgedBy1?.name || 'Habib Mulyana'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        acknowledgedBy1: {
                          ...(data.signatures.acknowledgedBy1 || { name: '', title: '(Chief Engineer)' }),
                          name: e.target.value
                        }
                      }
                    })}
                    placeholder="Habib Mulyana"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={data.signatures.acknowledgedBy1?.title || '(Chief Engineer)'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        acknowledgedBy1: {
                          ...(data.signatures.acknowledgedBy1 || { name: 'Habib Mulyana', title: '' }),
                          title: e.target.value
                        }
                      }
                    })}
                    placeholder="(Chief Engineer)"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                </div>

                <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                    ACKNOWLEDGED BY 2 (Facility Manager)
                  </span>
                  <input
                    type="text"
                    value={data.signatures.acknowledgedBy2?.name || 'Supriyatno'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        acknowledgedBy2: {
                          ...(data.signatures.acknowledgedBy2 || { name: '', title: '(Facility manager)' }),
                          name: e.target.value
                        }
                      }
                    })}
                    placeholder="Supriyatno"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={data.signatures.acknowledgedBy2?.title || '(Facility manager)'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        acknowledgedBy2: {
                          ...(data.signatures.acknowledgedBy2 || { name: 'Supriyatno', title: '' }),
                          title: e.target.value
                        }
                      }
                    })}
                    placeholder="(Facility manager)"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                </div>
              </div>

              {/* Row 3: APPROVED BY (Budi Susanto) */}
              <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                  APPROVED BY (Facility Management)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={data.signatures.approvedBy?.name || 'Budi Susanto'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        approvedBy: { ...data.signatures.approvedBy, name: e.target.value }
                      }
                    })}
                    placeholder="Budi Susanto"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={data.signatures.approvedBy?.title || '(Assistant manager HDC Facility Management)'}
                    onChange={e => setData({
                      ...data,
                      signatures: {
                        ...data.signatures,
                        approvedBy: { ...data.signatures.approvedBy, title: e.target.value }
                      }
                    })}
                    placeholder="(Assistant manager HDC Facility Management)"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={isExportingDocx}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Word (.docx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Export PDF (.pdf)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleSaveToFirestore}
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Laporan Prediktif</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
