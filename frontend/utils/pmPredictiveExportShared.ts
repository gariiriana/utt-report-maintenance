// ============================================================================
// FILE: frontend/utils/pmPredictiveExportShared.ts
// Deskripsi: Bahan bersama ekspor PDF & DOCX Predictive Report dari laporan PM
//            (satu unit maupun gabungan satu quarter): teks sel tabel parameter,
//            dasar batas acuan, catatan metode, ringkasan periode, dan foto
//            dokumentasi per equipment. Dokumen hanya berisi isi laporan teknis:
//            tanpa akun website, nomor internal, atau istilah alur aplikasi.
//            Import nilai memakai path relatif .ts agar teks ekspor bisa diuji
//            langsung dengan Node (scripts/test-pm-predictive-workflow.mjs).
// ============================================================================

import type { PmEquipmentSection, PmParamResult, PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';
import type { PmSourcePhoto } from '@/utils/pmPredictiveService';
import { PM_PREDICTIVE_PROFILES } from '../config/pmPredictiveProfiles.ts';
import { STATUS_LABEL, STATUS_RANK, effectiveStatus, fmtNum, fmtDate, matchCard } from './pmPredictiveEngine.ts';

export const METHOD_TEXT = 'Metode: nilai parameter berasal dari pengukuran saat Preventive Maintenance dan dinilai terhadap batas acuan di atas. '
  + 'Parameter tanpa batas acuan absolut dinilai terhadap pengukuran pertama unit yang sama (batas internal: berubah >20% = Perlu Dipantau, >35% = Peringatan). '
  + 'Tren dihitung dengan regresi linier atas riwayat pengukuran unit yang sama pada periode sebelumnya; perkiraan waktu mencapai batas '
  + 'bersifat indikatif dan keyakinannya bergantung pada jumlah titik data (2 titik = rendah, 3 = sedang, ≥4 dengan tren konsisten = tinggi).';

/** Teks status di dokumen; status kosong (hanya bagian tanpa angka & observasi jelas) dicetak "-". */
export const exportStatusText = (status: PmStatus) => (status === 'unknown' ? '-' : STATUS_LABEL[status]);

/** Data nameplate untuk tabel identitas; kosong bila tidak ada yang terbaca (baris & foto tidak dicetak). */
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
  return parts.join(' | ');
}

/** Parameter yang dicetak: hanya yang punya angka pada laporan ini. */
export const exportParams = (section: PmEquipmentSection): PmParamResult[] => section.params.filter(p => p.value !== null);

/** Kolom Sebelumnya & Perubahan hanya dicetak bila ada pengukuran pembanding. */
export const hasComparison = (report: PmPredictiveReport): boolean =>
  report.sections.some(s => exportParams(s).some(p => p.previous));

export interface PmParamRowText {
  label: string;
  value: string;
  previous: string;
  change: string;
  limit: string;
  status: PmStatus;
  statusText: string;
}

/** Teks satu baris tabel parameter (sama persis di PDF dan DOCX). */
export function paramRowText(p: PmParamResult): PmParamRowText {
  const unit = p.unit === '%' ? '%' : ` ${p.unit}`;
  const change = p.change !== null
    ? `${p.change > 0 ? '+' : ''}${fmtNum(p.change)}${unit}${p.trendPerQuarter !== null && p.points >= 3 ? `\n${p.trendPerQuarter > 0 ? '+' : ''}${fmtNum(p.trendPerQuarter)}${unit}/kuartal` : ''}`
    : '-';
  const status: PmStatus = p.value === null ? 'unknown' : p.status;
  return {
    label: p.label,
    value: p.value === null ? '-' : `${fmtNum(p.value)}${unit}`,
    previous: p.previous ? `${fmtNum(p.previous.value)}${unit}\n(${fmtDate(p.previous.date)})` : '-',
    change,
    limit: p.limitText || '-',
    status,
    statusText: exportStatusText(status),
  };
}

/** Status per equipment untuk ringkasan, mis. "Motor Fan (Blower): Normal". */
export const sectionStatusLines = (report: PmPredictiveReport): string =>
  report.sections.map(s => `${s.name}: ${exportStatusText(effectiveStatus(s))}`).join('\n');

/**
 * Dasar batas acuan parameter yang dicetak. Parameter dengan dasar yang sama
 * (mis. 6 titik tegangan) digabung satu baris; laporan gabungan memakai satu tabel.
 */
export function limitSourceRows(reports: PmPredictiveReport[]): [string, string][] {
  const bySource = new Map<string, string[]>();
  for (const report of reports) {
    const profile = PM_PREDICTIVE_PROFILES.find(p => p.id === report.profileId);
    if (!profile) continue;
    for (const p of report.sections.flatMap(exportParams)) {
      const def = profile.params[p.param];
      if (!def) continue;
      const labels = bySource.get(def.source) || [];
      if (!labels.includes(def.label)) bySource.set(def.source, [...labels, def.label]);
    }
  }
  return Array.from(bySource).map(([source, labels]) => [labels.join(', '), source]);
}

/** Equipment yang perlu perhatian (status Perlu Dipantau ke atas), untuk ringkasan periode. */
export function attentionText(report: PmPredictiveReport): string {
  const flagged = report.sections.filter(s => STATUS_RANK[effectiveStatus(s)] >= STATUS_RANK.watch);
  return flagged.length ? flagged.map(s => `${s.name} (${STATUS_LABEL[effectiveStatus(s)]})`).join(', ') : 'Tidak ada';
}

// ─── Foto dokumentasi ────────────────────────────────────────────────────────

export interface PmExportPhoto {
  /** Unik antar laporan (dipakai alias gambar PDF gabungan). */
  key: string;
  caption: string;
  dataUrl: string; // JPEG
  width: number;
  height: number;
}

export interface PmExportPhotos {
  nameplate: PmExportPhoto[];
  bySection: Record<string, PmExportPhoto[]>;
}

export const countExportPhotos = (photos: PmExportPhotos) =>
  photos.nameplate.length + Object.values(photos.bySection).reduce((n, list) => n + list.length, 0);

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
 * visual), serta foto nameplate. Pemanggil memuat foto laporan PM-nya.
 */
export async function collectPmExportPhotos(report: PmPredictiveReport, source: PmSourcePhoto[]): Promise<PmExportPhotos> {
  const byIndex = new Map(source.map(p => [p.index, p]));
  const profile = PM_PREDICTIVE_PROFILES.find(p => p.id === report.profileId);
  const cache = new Map<number, Promise<{ dataUrl: string; width: number; height: number } | null>>();
  const prepare = async (index: number, caption: string): Promise<PmExportPhoto | null> => {
    const photo = byIndex.get(index);
    if (!photo) return null;
    if (!cache.has(index)) cache.set(index, shrinkPhoto(photo.photoBase64));
    const img = await cache.get(index)!;
    return img ? { key: `${report.id}-${index}`, caption, ...img } : null;
  };
  const compact = (items: (PmExportPhoto | null)[]) => items.filter((p): p is PmExportPhoto => p !== null);

  const bySection: Record<string, PmExportPhoto[]> = {};
  for (const section of report.sections) {
    const eq = profile?.equipment.find(e => e.id === section.id);
    const seen = new Set<number>();
    const tasks: Promise<PmExportPhoto | null>[] = [];
    for (const r of report.readings) {
      if (!eq?.params.includes(r.param) || seen.has(r.photoIndex) || r.value === null) continue;
      seen.add(r.photoIndex);
      tasks.push(prepare(r.photoIndex, `${profile?.params[r.param]?.label || r.cardLabel}: ${fmtNum(r.value)} ${r.unit}`));
    }
    for (const v of section.visuals) {
      if (seen.has(v.photoIndex)) continue;
      seen.add(v.photoIndex);
      tasks.push(prepare(v.photoIndex, `${v.cardLabel}: ${v.condition}`));
    }
    bySection[section.id] = compact(await Promise.all(tasks));
  }

  const nameplatePhoto = profile && nameplateText(report) ? source.find(p => matchCard(profile, p.description)?.kind === 'nameplate') : undefined;
  const nameplate = nameplatePhoto ? compact([await prepare(nameplatePhoto.index, 'Nameplate motor')]) : [];
  return { nameplate, bySection };
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Satu laporan di dokumen gabungan beserta foto laporan PM-nya (dimuat bila kosong). */
export interface PmBundleEntry {
  report: PmPredictiveReport;
  photos?: PmSourcePhoto[];
}

/** Keterangan periode dokumen gabungan, mis. { label: 'Q2 2026', months: 'April - Juni 2026' }. */
export interface PmBundlePeriod {
  label: string;
  months: string;
}

/** Laporan gabungan diurutkan per tanggal PM lalu nama unit. */
export const sortBundleReports = <T extends { report: PmPredictiveReport }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.report.maintenanceDate.localeCompare(b.report.maintenanceDate)
    || a.report.unitLabel.localeCompare(b.report.unitLabel, 'id', { numeric: true }));
