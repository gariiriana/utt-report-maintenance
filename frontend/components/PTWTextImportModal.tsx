// ============================================================================
// FILE: PTWTextImportModal.tsx
// Deskripsi: Modal admin untuk mencatat banyak nomor PTW sekaligus dari teks
//            (salinan daftar PTW harian di WhatsApp). Teks di-parse dan
//            ditampilkan sebagai preview; nomor yang sudah tercatat dilewati.
// ============================================================================

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Loader2, CheckCircle2, ClipboardPaste } from 'lucide-react';
import { parsePTWListText, ParsedPTWStatus, PTWNumberEntry } from '@/utils/ptwTextImport';

const STATUS_STYLE: Record<ParsedPTWStatus, { label: string; className: string }> = {
  new: { label: 'Baru', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  exists: { label: 'Sudah ada', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  duplicate: { label: 'Dobel', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700 border-red-200' }
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface PTWTextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingKeys: Set<string>;
  onSubmit: (entries: PTWNumberEntry[]) => Promise<boolean>;
}

export function PTWTextImportModal({ isOpen, onClose, existingKeys, onSubmit }: PTWTextImportModalProps) {
  const [text, setText] = useState('');
  const [defaultDate, setDefaultDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parsePTWListText(text, existingKeys, defaultDate), [text, existingKeys, defaultDate]);
  const toSave = parsed.filter(r => r.status === 'new');
  const counts = parsed.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<ParsedPTWStatus, number>);

  const handleClose = () => {
    if (saving) return;
    setText('');
    onClose();
  };

  const handleSave = async () => {
    if (toSave.length === 0) return;
    setSaving(true);
    const ok = await onSubmit(toSave);
    setSaving(false);
    if (ok) {
      setText('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-full flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-black text-slate-900">Import Nomor PTW dari Teks</h3>
            <p className="text-slate-500 text-sm font-medium">
              Paste daftar PTW harian (header tanggal + baris TDE/PTW/...). Nomor yang sudah tercatat otomatis dilewati.
            </p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer" title="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4" /> Teks Daftar PTW
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'3 Agustus\n584. TDE/PTW/0633/LV/03/2026/08\n585. TDE/PTW/0634/Lift/03/2026/08\n\n*1 Oktober*\n- TDE/PTW/0802/CM VRV/04/2026/10'}
              className="w-full min-h-[300px] lg:min-h-[420px] p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
            <label className="text-xs font-bold text-slate-600">
              Tanggal untuk baris tanpa header tanggal
              <input
                type="date"
                value={defaultDate}
                onChange={(e) => setDefaultDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <div className="lg:col-span-3 flex flex-col min-w-0">
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(STATUS_STYLE) as ParsedPTWStatus[]).map(s => (
                <span key={s} className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_STYLE[s].className}`}>
                  {STATUS_STYLE[s].label}: {counts[s] || 0}
                </span>
              ))}
            </div>

            {parsed.length === 0 ? (
              <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Preview akan muncul setelah teks di-paste.
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 max-h-[460px]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">No PTW</th>
                      <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">Equipment</th>
                      <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">Q</th>
                      <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">Tanggal</th>
                      <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.map(r => (
                      <tr key={`${r.lineNo}-${r.key}`} className={r.status === 'new' ? '' : 'bg-slate-50/70'}>
                        <td className="px-3 py-2 font-bold text-indigo-900 whitespace-nowrap">{r.ptwNumber}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <span className="font-semibold">{r.equipmentCode}</span>
                          <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded ${r.ptwType === 'CM' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {r.ptwType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">Q{r.quarter}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.date || '-'}</td>
                        <td className="px-3 py-2">
                          <span
                            title={r.message}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[r.status].className}`}
                          >
                            {STATUS_STYLE[r.status].label}
                          </span>
                          {r.message && r.status === 'new' && (
                            <span className="block text-[10px] text-amber-600 mt-0.5">{r.message}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-2xl font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || toSave.length === 0}
            className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Simpan {toSave.length} Nomor PTW Baru
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
