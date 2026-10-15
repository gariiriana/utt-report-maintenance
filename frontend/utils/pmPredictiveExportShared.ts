// ============================================================================
// FILE: frontend/utils/pmPredictiveExportShared.ts
// Deskripsi: Bahan bersama ekspor PDF & DOCX Predictive Report dari laporan PM:
//            teks sel tabel parameter, dasar batas acuan, catatan metode, dan foto
//            dokumentasi per equipment (diambil dari foto kartu laporan PM asal).
// ============================================================================

import type { PmParamResult, PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';
import { PM_PREDICTIVE_PROFILES } from '@/config/pmPredictiveProfiles';
import { STATUS_LABEL, fmtNum, fmtDate, fmtMonthYear, matchCard } from '@/utils/pmPredictiveEngine';
import { loadPmSourcePhotos, type PmSourcePhoto } from '@/utils/pmPredictiveService';

export const METHOD_TEXT = 'Metode: angka pengukuran dibaca oleh AI dari foto dokumentasi PM lalu diperiksa dan dikonfirmasi engineer. '
  + 'Status ditentukan dari batas acuan di atas. Tren dihitung dengan regresi linier atas riwayat pengukuran unit yang sama pada laporan predictive sebelumnya; '
  + 'proyeksi waktu mencapai batas bersifat indikatif dan keyakinannya bergantung pada jumlah titik data (2 titik = rendah, 3 = sedang, ≥4 dengan tren konsisten = tinggi).';

export function nameplateText(r: PmPredictiveReport): string {
  const n = r.nameplate || {};
  const parts = [
    [n.brand, n.model].filter(Boolean).join(' '),
    n.serial ? `S/N ${n.serial}` : '',
    n.ratedVoltage ? `${fmtNum(n.ratedVoltage)} V` : '',
    n.ratedCurrent ? `${fmtNum(n.ratedCurrent)} A` : '',
    n.ratedPowerKw ? `${fmtNum(n.ratedPowerKw)} kW` : '',
    n.phase ? `${n.phase} fasa` : '',
    n.frequencyHz ? `${fmtNum(n.frequencyHz)} Hz` : '',
  ].filter(Boolean);
  if (!parts.length) return 'Data nameplate tidak terbaca';
  return parts.join(' | ') + (n.source === 'predictive sebelumnya' ? ' (dari predictive sebelumnya)' : '');
}

export interface PmParamRowText {
  label: string;
  value: string;
  previous: string;
  change: string;
  limit: string;
  status: PmStatus;
  statusText: string;
  projection: string;
}

/** Teks satu baris tabel parameter (sama persis di PDF dan DOCX). */
export function paramRowText(p: PmParamResult): PmParamRowText {
  const unit = p.unit === '%' ? '%' : ` ${p.unit}`;
  const change = p.change !== null
    ? `${p.change > 0 ? '+' : ''}${fmtNum(p.change)}${unit}${p.trendPerQuarter !== null && p.points >= 3 ? `\n${p.trendPerQuarter > 0 ? '+' : ''}${fmtNum(p.trendPerQuarter)}${unit}/kuartal` : ''}`
    : 'Baseline';
  const projection = p.projection
    ? `${p.projection.level === 'alarm' ? 'Kritis' : 'Peringatan'} ${fmtNum(p.projection.limit)}${unit} ~${fmtMonthYear(p.projection.date)} (${p.confidence})`
    : p.points >= 2 ? 'Tidak mengarah ke batas' : '-';
  const status: PmStatus = p.value === null ? 'unknown' : p.status;
  return {
    label: p.label,
    value: p.value === null ? '-' : `${fmtNum(p.value)}${unit}`,
    previous: p.previous ? `${fmtNum(p.previous.value)}${unit}\n(${fmtDate(p.previous.date)})` : '-',
    change,
    limit: p.limitText,
    status,
    statusText: status === 'unknown' && p.value !== null ? 'Info' : STATUS_LABEL[status],
    projection,
  };
}

/** Parameter dengan dasar acuan yang sama (mis. 6 titik tegangan) digabung satu baris. */
export function limitSourceRows(report: PmPredictiveReport): [string, string][] {
  const profile = PM_PREDICTIVE_PROFILES.find(p => p.id === report.profileId);
  const usedParams = Array.from(new Set(report.sections.flatMap(s => s.params.map(p => p.param))));
  if (!profile || !usedParams.length) return [];
  const bySource = new Map<string, string[]>();
  for (const p of usedParams) {
    const source = profile.params[p]?.source || '-';
    bySource.set(source, [...(bySource.get(source) || []), profile.params[p]?.label || p]);
  }
  return Array.from(bySource).map(([source, labels]) => [labels.join(', '), source]);
}

/** Nama equipment yang sengaja tidak dianalisis engineer. */
export function excludedEquipmentNames(report: PmPredictiveReport): string[] {
  const profile = PM_PREDICTIVE_PROFILES.find(p => p.id === report.profileId);
  return (report.excludedEquipment || []).map(id =>
    id === 'other' ? 'Observasi Visual Lainnya' : profile?.equipment.find(e => e.id === id)?.name || id);
}

// ─── Foto dokumentasi ────────────────────────────────────────────────────────

export interface PmExportPhoto {
  index: number;
  caption: string;
  dataUrl: string; // JPEG
  width: number;
  height: number;
}

export interface PmExportPhotos {
  nameplate: PmExportPhoto[];
  bySection: Record<string, PmExportPhoto[]>;
}

/** Perkecil foto untuk dokumen: cukup jelas dibaca saat dicetak, ukuran file tetap wajar. */
function shrinkPhoto(dataUrl: string, maxSide = 900, quality = 0.72): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width, height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Foto kartu laporan PM yang dipakai tiap bagian equipment (pengukuran + observasi
 * visual), serta foto nameplate. Foto yang sudah dimuat modal dipakai ulang agar
 * tidak membaca Firestore lagi.
 */
export async function collectPmExportPhotos(report: PmPredictiveReport, loaded?: PmSourcePhoto[]): Promise<PmExportPhotos> {
  let source = loaded && loaded.length ? loaded : [];
  if (!source.length) {
    try {
      source = await loadPmSourcePhotos(report.sourceDocId, report.sourceCollection);
    } catch (err) {
      console.warn('Foto laporan PM tidak bisa dimuat untuk ekspor:', err);
      source = [];
    }
  }
  const byIndex = new Map(source.map(p => [p.index, p]));
  const profile = PM_PREDICTIVE_PROFILES.find(p => p.id === report.profileId);
  const cache = new Map<number, Promise<{ dataUrl: string; width: number; height: number } | null>>();
  const prepare = async (index: number, caption: string): Promise<PmExportPhoto | null> => {
    const photo = byIndex.get(index);
    if (!photo) return null;
    if (!cache.has(index)) cache.set(index, shrinkPhoto(photo.photoBase64));
    const img = await cache.get(index)!;
    return img ? { index, caption, ...img } : null;
  };
  const compact = (items: (PmExportPhoto | null)[]) => items.filter((p): p is PmExportPhoto => p !== null);

  const bySection: Record<string, PmExportPhoto[]> = {};
  for (const section of report.sections) {
    const eq = profile?.equipment.find(e => e.id === section.id);
    const seen = new Set<number>();
    const tasks: Promise<PmExportPhoto | null>[] = [];
    for (const r of report.readings) {
      if (!eq?.params.includes(r.param) || seen.has(r.photoIndex)) continue;
      seen.add(r.photoIndex);
      const label = profile?.params[r.param]?.label || r.cardLabel;
      const value = r.value === null ? 'tidak ada angka' : `${fmtNum(r.value)} ${r.unit}`;
      tasks.push(prepare(r.photoIndex, `${label}: ${value}`));
    }
    for (const v of section.visuals) {
      if (seen.has(v.photoIndex)) continue;
      seen.add(v.photoIndex);
      tasks.push(prepare(v.photoIndex, `${v.cardLabel}: ${v.condition}`));
    }
    bySection[section.id] = compact(await Promise.all(tasks));
  }

  const nameplatePhoto = profile ? source.find(p => matchCard(profile, p.description)?.kind === 'nameplate') : undefined;
  const nameplate = nameplatePhoto ? compact([await prepare(nameplatePhoto.index, 'Nameplate motor')]) : [];
  return { nameplate, bySection };
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}
