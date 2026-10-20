// ============================================================================
// FILE: frontend/components/PmPredictiveParts.tsx
// Deskripsi: Komponen bersama Predictive Report dari laporan PM, dipakai generate
//            satu laporan (PmPredictiveModal) dan per quarter (PmPredictiveQuarterModal)
//            agar alurnya sama persis: editor konfirmasi angka per equipment +
//            nameplate, dan tampilan hasil (status, ringkasan, narasi yang bisa diedit).
// ============================================================================

import { Camera, RotateCw } from 'lucide-react';
import type { PmProfile } from '@/config/pmPredictiveProfiles';
import type { PmSourcePhoto } from '@/utils/pmPredictiveService';
import { STATUS_LABEL, effectiveStatus, worstStatus, fmtNum, fmtDate } from '@/utils/pmPredictiveEngine';
import { exportParams } from '@/utils/pmPredictiveExportShared';
import {
  draftStats, hasNameplateData, isGroupIncluded, isInputInvalid, parseInput,
  type MeasureRow, type PmReadingDraft, type VisualRow,
} from '@/utils/pmPredictiveWorkflow';
import type { PmConfidence, PmNameplate, PmPredictiveReport, PmStatus, PmVisualCondition } from '@/types/pmPredictiveTypes';

export const STATUS_BADGE: Record<PmStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-300',
  alarm: 'bg-red-50 text-red-700 border-red-300',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};

const CONFIDENCE_BADGE: Record<PmConfidence, string> = {
  tinggi: 'bg-emerald-50 text-emerald-700',
  sedang: 'bg-amber-50 text-amber-700',
  rendah: 'bg-red-50 text-red-700',
};

export function PmStatusBadge({ status, small }: { status: PmStatus; small?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-black uppercase tracking-wide ${small ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'} ${STATUS_BADGE[status]}`}>
      {status === 'unknown' ? '-' : STATUS_LABEL[status]}
    </span>
  );
}

export type PmZoom = { src: string; title: string };

export function PmPhotoThumb({ photo, title, onZoom }: { photo?: PmSourcePhoto; title: string; onZoom: (z: PmZoom) => void }) {
  if (!photo) return <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Camera className="w-4 h-4 text-slate-400" /></div>;
  return (
    <button type="button" onClick={() => onZoom({ src: photo.photoBase64, title })} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in" title="Perbesar foto">
      <img src={photo.photoBase64} alt={title} className="w-full h-full object-cover" />
    </button>
  );
}

export function PmPhotoZoom({ zoom, onClose }: { zoom: PmZoom | null; onClose: () => void }) {
  if (!zoom) return null;
  return (
    <div className="fixed inset-0 z-[160] bg-black/85 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <p className="text-white text-sm font-bold mb-3">{zoom.title}</p>
      <img src={zoom.src} alt={zoom.title} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
    </div>
  );
}

// ─── Editor konfirmasi angka ─────────────────────────────────────────────────

interface PmReadingsEditorProps {
  profile: PmProfile;
  draft: PmReadingDraft;
  onChange: (fn: (d: PmReadingDraft) => PmReadingDraft) => void;
  photoByIndex: Map<number, PmSourcePhoto>;
  onZoom: (z: PmZoom) => void;
  /** Sedang mengedit angka predictive tersimpan (label "terdeteksi AI" disembunyikan). */
  editing?: boolean;
  /** Nameplate predictive sebelumnya, dipakai bila nameplate laporan ini kosong. */
  previousNameplate?: PmNameplate | null;
  onRetryFailed?: (indexes: Set<number>) => void;
}

export function PmReadingsEditor({ profile, draft, onChange, photoByIndex, onZoom, editing, previousNameplate, onRetryFailed }: PmReadingsEditorProps) {
  const stats = draftStats(profile, draft);
  const setMeasure = (photoIndex: number, input: string) =>
    onChange(d => ({ ...d, measures: d.measures.map(r => (r.photoIndex === photoIndex ? { ...r, input } : r)) }));
  const setVisual = (photoIndex: number, patch: Partial<VisualRow>) =>
    onChange(d => ({ ...d, visuals: d.visuals.map(r => (r.photoIndex === photoIndex ? { ...r, ...patch } : r)) }));

  const renderMeasureRow = (m: MeasureRow) => {
    const def = profile.params[m.param];
    const flagged = m.state === 'failed' || (m.state === 'done' && (m.aiConfidence !== 'tinggi' || m.input === ''));
    return (
      <div key={m.photoIndex} className={`flex items-center gap-3 p-2.5 ${flagged ? 'bg-amber-50/60' : ''}`}>
        <PmPhotoThumb photo={photoByIndex.get(m.photoIndex)} title={`${m.cardLabel} — ${def.label}`} onZoom={onZoom} />
        <div className="flex-1 min-w-0 text-xs">
          <p className="font-bold text-slate-800 truncate">{def.label} <span className="font-medium text-slate-400">· kartu "{m.cardLabel}"</span></p>
          {m.state === 'done' && (
            <p className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
              AI: <strong className="text-slate-700">{m.aiRaw || (m.aiValue !== null ? `${m.aiValue} ${m.aiUnit || ''}` : 'tidak terbaca')}</strong>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${CONFIDENCE_BADGE[m.aiConfidence]}`}>{m.aiConfidence}</span>
            </p>
          )}
          {m.note && <p className="text-[10px] text-amber-700 mt-0.5">{m.note}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            value={m.input}
            onChange={e => setMeasure(m.photoIndex, e.target.value)}
            inputMode="decimal"
            disabled={m.state === 'pending'}
            className={`w-20 sm:w-24 px-2 py-1.5 rounded-lg border text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-300 ${isInputInvalid(m.input) ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
            placeholder="-"
            aria-label={`Nilai ${def.label}`}
          />
          <span className="w-12 text-[11px] font-bold text-slate-500">{def.unit}</span>
        </div>
      </div>
    );
  };

  const renderVisualRow = (v: VisualRow) => (
    <div key={v.photoIndex} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2.5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <PmPhotoThumb photo={photoByIndex.get(v.photoIndex)} title={v.cardLabel} onZoom={onZoom} />
        <p className="text-xs font-bold text-slate-800 truncate">{v.cardLabel}</p>
      </div>
      <select
        value={v.condition}
        onChange={e => setVisual(v.photoIndex, { condition: e.target.value as PmVisualCondition })}
        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
      >
        {(['baik', 'perlu perhatian', 'buruk', 'tidak jelas'] as const).map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        value={v.observation}
        onChange={e => setVisual(v.photoIndex, { observation: e.target.value })}
        placeholder="Keterangan kondisi"
        className="sm:w-72 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  );

  const nameplate = draft.nameplate;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800">{stats.included.length} dari {stats.groups.length} equipment dianalisis</span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{stats.includedRows.length} angka</span>
        {stats.lowConfidence > 0 && <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">{stats.lowConfidence} keyakinan AI tidak tinggi, cek fotonya</span>}
        {stats.pendingRows > 0 && <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700">{stats.pendingRows} kosong / gagal dibaca</span>}
        {stats.failedIndexes.size > 0 && onRetryFailed && (
          <button type="button" onClick={() => onRetryFailed(stats.failedIndexes)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white flex items-center gap-1 cursor-pointer">
            <RotateCw className="w-3 h-3" /> Baca ulang {stats.failedIndexes.size} foto gagal
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Centang equipment yang ingin dimasukkan ke predictive. Equipment yang angka atau kondisinya ditemukan AI sudah dicentang otomatis.
      </p>

      {stats.groups.map(g => {
        const on = isGroupIncluded(draft, g);
        const filled = g.rows.filter(r => r.input.trim() !== '').length;
        const info = [
          g.rows.length ? `${filled}/${g.rows.length} angka` : '',
          g.visuals.length ? `${g.visuals.length} observasi` : '',
        ].filter(Boolean).join(' · ');
        return (
          <div key={g.id} className={`rounded-2xl border overflow-hidden ${on ? 'border-slate-200' : 'border-dashed border-slate-300'}`}>
            <label className={`px-3 py-2 border-b flex items-center gap-2 cursor-pointer ${on ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={e => onChange(d => ({ ...d, selection: { ...d.selection, [g.id]: e.target.checked } }))}
                className="w-4 h-4 accent-indigo-600 shrink-0"
                aria-label={`Masukkan ${g.name} ke predictive`}
              />
              <span className={`flex-1 min-w-0 text-xs font-black ${on ? 'text-slate-800' : 'text-slate-400'}`}>{g.name}</span>
              <span className="text-[10px] font-semibold text-slate-500 shrink-0">{info}{g.detected && !editing && g.rows.some(r => r.state === 'done') ? ' · terdeteksi AI' : ''}</span>
            </label>
            {on ? (
              <div className="divide-y divide-slate-100">
                {g.rows.map(renderMeasureRow)}
                {g.visuals.map(renderVisualRow)}
              </div>
            ) : (
              <p className="px-3 pb-2.5 text-[11px] text-slate-500">Tidak dimasukkan ke predictive. Angkanya tetap disimpan, tetapi tidak dianalisis dan riwayat equipment ini tidak diperbarui.</p>
            )}
          </div>
        );
      })}

      <div className="rounded-2xl border border-violet-200 overflow-hidden">
        <div className="px-3 py-2 bg-violet-50 border-b border-violet-200 text-xs font-black text-violet-900 flex items-center justify-between gap-2">
          <span>Nameplate (rating pabrik)</span>
          {draft.nameplateState === 'done' && <span className="text-[10px] font-semibold text-violet-700">dibaca AI, periksa kembali</span>}
        </div>
        <div className="p-3 flex gap-3">
          {draft.nameplatePhotoIndex !== null && <PmPhotoThumb photo={photoByIndex.get(draft.nameplatePhotoIndex)} title="Nameplate" onZoom={onZoom} />}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {([
              ['brand', 'Merk', 'text'], ['model', 'Model', 'text'], ['ratedVoltage', 'Tegangan (V)', 'num'], ['ratedCurrent', 'Arus FLA (A)', 'num'],
              ['ratedPowerKw', 'Daya (kW)', 'num'], ['phase', 'Fasa', 'num'], ['frequencyHz', 'Frek. (Hz)', 'num'], ['serial', 'Serial', 'text'],
            ] as const).map(([key, lbl, kind]) => (
              <label key={key} className="font-bold text-slate-600">
                {lbl}
                <input
                  value={(nameplate as any)[key] ?? ''}
                  inputMode={kind === 'num' ? 'decimal' : undefined}
                  onChange={e => onChange(d => ({ ...d, nameplate: { ...d.nameplate, [key]: kind === 'num' ? parseInput(e.target.value) : e.target.value, source: 'manual' } }))}
                  className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </label>
            ))}
          </div>
        </div>
        {!hasNameplateData(nameplate) && hasNameplateData(previousNameplate) && (
          <p className="px-3 pb-3 text-[11px] text-violet-800">Kosong: akan memakai nameplate dari predictive sebelumnya ({[previousNameplate!.brand, previousNameplate!.model].filter(Boolean).join(' ') || 'data rating'}).</p>
        )}
        {!hasNameplateData(nameplate) && !hasNameplateData(previousNameplate) && (
          <p className="px-3 pb-3 text-[11px] text-slate-500">Tanpa arus FLA nameplate, beban motor terhadap rating tidak dihitung (baris tersebut tidak dicetak).</p>
        )}
      </div>
    </div>
  );
}

// ─── Tampilan hasil ──────────────────────────────────────────────────────────

/** Terapkan perubahan engineer lalu hitung ulang status keseluruhan. */
export function applyReportChange(r: PmPredictiveReport, fn: (r: PmPredictiveReport) => PmPredictiveReport): PmPredictiveReport {
  const updated = fn(r);
  return { ...updated, overallStatus: worstStatus(updated.sections.map(effectiveStatus)) };
}

interface PmPredictiveResultViewProps {
  report: PmPredictiveReport;
  profile: PmProfile | null;
  readOnly: boolean;
  onChange: (fn: (r: PmPredictiveReport) => PmPredictiveReport) => void;
  /** Input penanda tangan per laporan (generate per quarter memakai satu input bersama). */
  showSignatures?: boolean;
}

export function PmPredictiveResultView({ report, profile, readOnly, onChange, showSignatures = true }: PmPredictiveResultViewProps) {
  const ta = 'w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-700';
  const updateSection = (id: string, fn: (s: PmPredictiveReport['sections'][number]) => PmPredictiveReport['sections'][number]) =>
    onChange(r => ({ ...r, sections: r.sections.map(s => (s.id === id ? fn(s) : s)) }));
  const excluded = report.excludedEquipment || [];
  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-2xl border ${STATUS_BADGE[report.overallStatus]}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Status keseluruhan · {report.unitLabel}</p>
            <p className="text-lg font-black">{report.overallStatus === 'unknown' ? '-' : STATUS_LABEL[report.overallStatus]}</p>
          </div>
          <p className="text-[11px] text-slate-600 sm:text-right">
            PM {fmtDate(report.maintenanceDate)} · {report.previousMaintenanceDate ? `pembanding PM ${fmtDate(report.previousMaintenanceDate)}` : 'pengukuran pertama (belum ada pembanding)'}
          </p>
        </div>
        {excluded.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-600">
            Tidak dianalisis: {excluded.map(id => (id === 'other' ? 'Observasi Visual Lainnya' : profile?.equipment.find(e => e.id === id)?.name || id)).join(', ')}
          </p>
        )}
      </div>

      <div className="p-3 rounded-2xl border border-slate-200 space-y-2">
        <p className="text-xs font-black text-slate-800">Ringkasan eksekutif {report.summary.source === 'otomatis' && <span className="font-semibold text-amber-700">(disusun otomatis, AI tidak tersedia)</span>}</p>
        <textarea rows={4} disabled={readOnly} value={report.summary.ringkasan} onChange={e => onChange(r => ({ ...r, summary: { ...r.summary, ringkasan: e.target.value } }))} className={ta} />
        <label className="block text-[11px] font-bold text-slate-600">Prioritas tindakan (satu per baris)
          <textarea rows={3} disabled={readOnly} value={report.summary.prioritas.join('\n')} onChange={e => onChange(r => ({ ...r, summary: { ...r.summary, prioritas: e.target.value.split('\n') } }))} className={ta} />
        </label>
      </div>

      {report.sections.map(section => {
        const status = effectiveStatus(section);
        const params = exportParams(section);
        return (
          <div key={section.id} className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">{section.name}</p>
                <p className="text-[10px] text-slate-500">{section.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <PmStatusBadge status={status} />
                {!readOnly && (
                  <select
                    value={section.statusOverride || ''}
                    onChange={e => updateSection(section.id, s => ({ ...s, statusOverride: (e.target.value || null) as PmStatus | null }))}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold bg-white"
                    title="Koreksi status oleh engineer"
                  >
                    <option value="">Status sistem ({section.status === 'unknown' ? '-' : STATUS_LABEL[section.status]})</option>
                    {(['normal', 'watch', 'warning', 'alarm'] as const).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                )}
              </div>
            </div>

            {params.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] min-w-[640px]">
                  <thead className="bg-white text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="text-left px-3 py-1.5">Parameter</th>
                      <th className="text-right px-2 py-1.5">Nilai</th>
                      <th className="text-right px-2 py-1.5">Sebelumnya</th>
                      <th className="text-left px-2 py-1.5">Batas acuan</th>
                      <th className="text-left px-2 py-1.5">Status</th>
                      <th className="text-left px-3 py-1.5">Catatan tren</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {params.map(p => {
                      const unit = p.unit === '%' ? '%' : ` ${p.unit}`;
                      return (
                        <tr key={p.param} className="align-top">
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{p.label}</td>
                          <td className="px-2 py-1.5 text-right font-black text-slate-900 whitespace-nowrap">{fmtNum(p.value)}{unit}</td>
                          <td className="px-2 py-1.5 text-right text-slate-500 whitespace-nowrap">{p.previous ? `${fmtNum(p.previous.value)}${unit}` : '-'}</td>
                          <td className="px-2 py-1.5 text-slate-500">{p.limitText || '-'}</td>
                          <td className="px-2 py-1.5">{p.status === 'unknown' ? <span className="text-slate-400 font-bold">-</span> : <PmStatusBadge status={p.status} small />}</td>
                          <td className="px-3 py-1.5 text-slate-600">{p.note || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {section.visuals.length > 0 && (
              <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                {section.visuals.map(v => <p key={v.photoIndex}><strong className="text-slate-800">{v.cardLabel}:</strong> {v.condition}{v.observation ? ` — ${v.observation}` : ''}</p>)}
              </div>
            )}

            <div className="p-3 border-t border-slate-100 space-y-2">
              {section.narrativeSource === 'otomatis' && <p className="text-[10px] font-bold text-amber-700">Narasi disusun otomatis karena AI tidak tersedia; silakan disempurnakan.</p>}
              {([['kondisi', 'Kondisi saat ini'], ['analisisTren', 'Analisis tren'], ['prediksiRisiko', 'Prediksi & risiko']] as const).map(([key, lbl]) => (
                <label key={key} className="block text-[11px] font-bold text-slate-600">{lbl}
                  <textarea rows={3} disabled={readOnly} value={section.narrative[key]} onChange={e => updateSection(section.id, s => ({ ...s, narrative: { ...s.narrative, [key]: e.target.value } }))} className={ta} />
                </label>
              ))}
              <label className="block text-[11px] font-bold text-slate-600">Rekomendasi (satu per baris)
                <textarea rows={3} disabled={readOnly} value={section.narrative.rekomendasi.join('\n')} onChange={e => updateSection(section.id, s => ({ ...s, narrative: { ...s.narrative, rekomendasi: e.target.value.split('\n') } }))} className={ta} />
              </label>
            </div>
          </div>
        );
      })}

      {!readOnly && showSignatures && (
        <PmPreparedByInput value={report.signatures.preparedBy} onChange={preparedBy => onChange(r => ({ ...r, signatures: { ...r.signatures, preparedBy } }))} />
      )}
    </div>
  );
}

export function PmPreparedByInput({ value, onChange, hint }: { value: { name: string; title: string }; onChange: (v: { name: string; title: string }) => void; hint?: string }) {
  return (
    <div className="p-3 rounded-2xl border border-slate-200 grid sm:grid-cols-2 gap-2 text-[11px]">
      {hint && <p className="sm:col-span-2 text-slate-500">{hint}</p>}
      <label className="font-bold text-slate-600">Prepared by (nama)
        <input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold" />
      </label>
      <label className="font-bold text-slate-600">Jabatan
        <input value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold" />
      </label>
    </div>
  );
}
