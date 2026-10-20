// ============================================================================
// FILE: frontend/utils/pmPredictiveEngine.ts
// Deskripsi: Mesin hitung deterministik Predictive Report dari laporan PM.
//            Pemetaan kartu, konversi satuan, parameter turunan, status terhadap
//            batas acuan profil, tren regresi linier, dan proyeksi tanggal mencapai
//            batas. AI tidak menghitung apa pun di sini; ia hanya menarasikan hasilnya.
//            Hanya import tipe (terhapus saat runtime) agar bisa diuji langsung
//            dengan Node: scripts/test-pm-predictive-engine.mjs.
// ============================================================================

import type { PmProfile, PmRule, PmParamDef, PmCardMapping } from '@/config/pmPredictiveProfiles';
import type {
  PmStatus, PmHistory, PmSeriesPoint, PmParamResult, PmProjection, PmNameplate,
  PmVisualObservation, PmEquipmentSection, PmSectionNarrative,
} from '@/types/pmPredictiveTypes';

const DAY_MS = 86400000;
const QUARTER_DAYS = 91;
/** Proyeksi lebih jauh dari ini tidak dilaporkan (terlalu spekulatif). */
const MAX_PROJECTION_DAYS = 3 * 365;

export const STATUS_RANK: Record<PmStatus, number> = { unknown: -1, normal: 0, watch: 1, warning: 2, alarm: 3 };

export const STATUS_LABEL: Record<PmStatus, string> = {
  normal: 'Normal',
  watch: 'Perlu Dipantau',
  warning: 'Peringatan',
  alarm: 'Kritis',
  unknown: 'Belum Dapat Dinilai',
};

// ─── Format ──────────────────────────────────────────────────────────────────

export function fmtNum(v: number | null | undefined, maxDecimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  const rounded = Number(v.toFixed(maxDecimals));
  return String(rounded);
}

export function fmtMonthYear(isoDate: string): string {
  const d = parseISODate(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDate(isoDate: string): string {
  const d = parseISODate(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return new Date(d.getTime() + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (!da || !db) return 0;
  return (db.getTime() - da.getTime()) / DAY_MS;
}

// ─── Identitas unit & kartu ──────────────────────────────────────────────────

export function normalizeLabel(label: string): string {
  return (label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Kunci unit untuk menyambung riwayat antar laporan: akun + nama unit yang
 * dinormalisasi, sehingga "FCU-01 Lt.2", "FCU 1 lt 2", dan "fcu01 LT2" sama.
 */
export function unitKeyOf(account: string, unitLabel: string): string {
  const unit = (unitLabel || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(tok => tok.replace(/^([a-z]*)0+(\d)/, '$1$2'))
    .join('');
  return `${(account || '').toLowerCase().trim()}|${unit || 'unit'}`;
}

const LABEL_PREFIXES = ['measurement', 'measure', 'pengukuran', 'checking', 'check', 'cek', 'cleaning', 'pembersihan', 'voltage', 'voltase', 'tegangan'];

function stripLabelPrefixes(norm: string): string {
  let out = norm;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of LABEL_PREFIXES) {
      if (out.startsWith(p) && out.length > p.length) {
        out = out.slice(p.length);
        changed = true;
      }
    }
  }
  return out;
}

/** Cocokkan label kartu laporan PM ke pemetaan profil (null = kartu tidak dikenal). */
export function matchCard(profile: PmProfile, label: string): PmCardMapping | null {
  const core = stripLabelPrefixes(normalizeLabel(label));
  if (!core) return null;
  const exact = profile.cards.find(c => c.match.includes(core));
  if (exact) return exact;
  // Label panjang/bervariasi ("Checking Humidity Ruang"): cocokkan kata kunci >= 4 huruf.
  return profile.cards.find(c => c.match.some(m => m.length >= 4 && core.includes(m))) || null;
}

// ─── Satuan ──────────────────────────────────────────────────────────────────

function normUnit(u: string): string {
  return (u || '').toLowerCase().replace(/\s+/g, '').replace(/[~]/g, '').replace('℃', '°c').replace('℉', '°f');
}

/**
 * Konversi angka hasil baca ke satuan kanonik profil. Satuan kosong dianggap
 * sudah kanonik. Satuan yang tidak bisa dikonversi (mis. getaran dalam g)
 * dikembalikan null beserta catatan agar engineer mengisi manual.
 */
export function convertToCanonical(value: number | null, fromUnit: string | undefined, canonical: string): { value: number | null; note?: string } {
  if (value === null || !Number.isFinite(value)) return { value: null };
  const u = normUnit(fromUnit || '');
  if (!u) return { value };
  const c = canonical;
  const ok = (v: number) => ({ value: Number(v.toFixed(4)) });
  switch (c) {
    case 'V':
      if (['v', 'vac', 'vdc', 'volt'].includes(u)) return ok(value);
      if (u === 'mv') return ok(value / 1000);
      if (u === 'kv') return ok(value * 1000);
      break;
    case 'A':
      if (['a', 'aac', 'amp', 'ampere'].includes(u)) return ok(value);
      if (u === 'ma') return ok(value / 1000);
      break;
    case 'mm/s':
      if (['mm/s', 'mms', 'mm/srms'].includes(u)) return ok(value);
      if (['in/s', 'ips', 'in/srms'].includes(u)) return ok(value * 25.4);
      return { value: null, note: `Satuan getaran "${fromUnit}" tidak bisa dikonversi ke mm/s; isi manual dalam mm/s RMS.` };
    case 'dB(A)':
      if (['db', 'dba', 'db(a)', 'dbc', 'db(c)'].includes(u)) return ok(value);
      break;
    case 'm/s':
      if (['m/s', 'ms', 'mps'].includes(u)) return ok(value);
      if (['ft/min', 'fpm'].includes(u)) return ok(value * 0.00508);
      if (['km/h', 'kmh', 'km/j'].includes(u)) return ok(value / 3.6);
      break;
    case '%RH':
      if (['%', '%rh', 'rh', 'rh%'].includes(u)) return ok(value);
      break;
    case '°C':
      if (['°c', 'c', 'degc', 'celsius'].includes(u)) return ok(value);
      if (['°f', 'f', 'degf'].includes(u)) return ok((value - 32) * 5 / 9);
      break;
    case 'bar':
      if (u === 'bar') return ok(value);
      if (u === 'psi') return ok(value * 0.0689476);
      if (u === 'kpa') return ok(value / 100);
      if (u === 'mpa') return ok(value * 10);
      if (['kgf/cm2', 'kg/cm2', 'kgf/cm²', 'kg/cm²'].includes(u)) return ok(value * 0.980665);
      break;
    case '%':
      if (u === '%') return ok(value);
      break;
  }
  return { value: null, note: `Satuan "${fromUnit}" berbeda dari ${canonical}; periksa foto dan isi manual dalam ${canonical}.` };
}

// ─── Parameter turunan ───────────────────────────────────────────────────────

function maxDeviationPct(vals: (number | null | undefined)[], minBasis = 0): number | null {
  if (vals.some(v => v === null || v === undefined || !Number.isFinite(v))) return null;
  const nums = vals as number[];
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (avg <= 0 || avg < minBasis) return null;
  return Math.max(...nums.map(v => Math.abs(v - avg))) / avg * 100;
}

/** Hitung parameter turunan (ketidakseimbangan, beban %FLA, selisih tekanan). */
export function computeDerived(profile: PmProfile, values: Record<string, number | null>, nameplate: PmNameplate): Record<string, number | null> {
  const out: Record<string, number | null> = { ...values };
  for (const [key, def] of Object.entries(profile.params)) {
    if (!def.derived) continue;
    let v: number | null = null;
    if (def.derived === 'voltageUnbalanceLL') {
      v = maxDeviationPct([values.v_rs, values.v_rt, values.v_st]);
    } else if (def.derived === 'currentUnbalance') {
      v = maxDeviationPct([values.i_r, values.i_s, values.i_t], def.minBasis || 0);
    } else if (def.derived === 'currentLoadPct') {
      const fla = nameplate.ratedCurrent;
      const currents = [values.i_r, values.i_s, values.i_t].filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
      v = fla && fla > 0 && currents.length ? Math.max(...currents) / fla * 100 : null;
    } else if (def.derived === 'pressureDiff') {
      v = typeof values.p_supply === 'number' && typeof values.p_return === 'number' ? values.p_supply - values.p_return : null;
    }
    out[key] = v === null ? null : Number(v.toFixed(3));
  }
  return out;
}

// ─── Riwayat ─────────────────────────────────────────────────────────────────

/**
 * Gabungkan riwayat predictive sebelumnya dengan angka laporan ini. Titik pada
 * tanggal yang sama atau dari laporan yang sama diganti (regenerate tidak
 * menggandakan titik). Hanya titik yang lebih awal dari laporan ini yang dibawa.
 */
export function mergeHistory(prev: PmHistory | null | undefined, values: Record<string, number | null>, date: string, reportId: string): PmHistory {
  const out: PmHistory = {};
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(values)]);
  for (const key of keys) {
    const earlier = (prev?.[key] || []).filter(p => p.reportId !== reportId && p.date < date && Number.isFinite(p.value));
    const v = values[key];
    const series = typeof v === 'number' && Number.isFinite(v) ? [...earlier, { date, value: v, reportId }] : earlier;
    if (series.length) out[key] = series.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

export function linearTrend(points: PmSeriesPoint[]): { slopePerDay: number; r2: number } | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map(p => daysBetween(x0, p.date));
  const ys = points.map(p => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slopePerDay: slope, r2 };
}

// ─── Status & batas ──────────────────────────────────────────────────────────

interface Limit { level: 'watch' | 'warning' | 'alarm'; value: number; side: 'above' | 'below' }

/** Nominal aturan band; dari rating nameplate bila tersedia (fromNameplate = true). */
function nominalFor(rule: Extract<PmRule, { type: 'band' }>, np: PmNameplate): { nominal: number; fromNameplate: boolean } {
  const rv = np.ratedVoltage;
  if (rule.nominalFrom && rv && rv > 0) {
    if (rv >= 300 && rv <= 700) return { nominal: rule.nominalFrom === 'ratedVoltageLL' ? rv : rv / Math.sqrt(3), fromNameplate: true };
    if (rv >= 180 && rv < 300) return { nominal: rule.nominalFrom === 'ratedVoltageLN' ? rv : rv * Math.sqrt(3), fromNameplate: true };
  }
  return { nominal: rule.nominal, fromNameplate: false };
}

/** Batas absolut sebuah aturan untuk nilai/riwayat saat ini (dipakai status & proyeksi). */
function limitsOf(rule: PmRule, np: PmNameplate, baseline: number | null): Limit[] {
  const L: Limit[] = [];
  const push = (level: Limit['level'], value: number | undefined, side: Limit['side']) => {
    if (value !== undefined && Number.isFinite(value)) L.push({ level, value, side });
  };
  switch (rule.type) {
    case 'band': {
      const nom = nominalFor(rule, np).nominal;
      for (const [level, pct] of [['watch', rule.watchPct], ['warning', rule.warningPct], ['alarm', rule.alarmPct]] as const) {
        if (pct === undefined) continue;
        const lowPct = level === 'warning' && rule.warningLowPct !== undefined ? rule.warningLowPct : pct;
        push(level, nom * (1 + pct / 100), 'above');
        push(level, nom * (1 - lowPct / 100), 'below');
      }
      break;
    }
    case 'upper':
      push('watch', rule.watch, 'above');
      push('warning', rule.warning, 'above');
      push('alarm', rule.alarm, 'above');
      break;
    case 'pctOfRatedCurrent': {
      const fla = np.ratedCurrent;
      if (fla && fla > 0) {
        if (rule.watchPct !== undefined) push('watch', fla * rule.watchPct / 100, 'above');
        push('warning', fla * rule.warningPct / 100, 'above');
        if (rule.alarmPct !== undefined) push('alarm', fla * rule.alarmPct / 100, 'above');
      }
      break;
    }
    case 'range':
      push('warning', rule.lowWarning, 'below');
      push('alarm', rule.lowAlarm, 'below');
      push('watch', rule.highWatch, 'above');
      push('warning', rule.highWarning, 'above');
      push('alarm', rule.highAlarm, 'above');
      break;
    case 'dropFromBaseline':
      if (baseline !== null && baseline > 0) {
        push('watch', baseline * (1 - rule.watchPct / 100), 'below');
        push('warning', baseline * (1 - rule.warningPct / 100), 'below');
        if (rule.alarmPct !== undefined) push('alarm', baseline * (1 - rule.alarmPct / 100), 'below');
      }
      break;
    case 'changeFromBaseline':
      if (baseline !== null && baseline !== 0) {
        const b = Math.abs(baseline);
        push('watch', baseline + b * rule.watchPct / 100, 'above');
        push('watch', baseline - b * rule.watchPct / 100, 'below');
        push('warning', baseline + b * rule.warningPct / 100, 'above');
        push('warning', baseline - b * rule.warningPct / 100, 'below');
      }
      break;
  }
  return L;
}

function statusFromLimits(value: number, limits: Limit[]): PmStatus {
  let s: PmStatus = 'normal';
  for (const l of limits) {
    const crossed = l.side === 'above' ? value > l.value : value < l.value;
    if (crossed && STATUS_RANK[l.level] > STATUS_RANK[s]) s = l.level;
  }
  return s;
}

function ruleText(rule: PmRule, unit: string, np: PmNameplate, baseline: number | null): string {
  const u = unit === '%' ? '%' : ` ${unit}`;
  switch (rule.type) {
    case 'band': {
      const { nominal: nom, fromNameplate } = nominalFor(rule, np);
      const parts: string[] = [];
      if (rule.warningPct !== undefined) {
        const lowPct = rule.warningLowPct ?? rule.warningPct;
        const tol = lowPct === rule.warningPct ? `±${rule.warningPct}%` : `+${rule.warningPct}%/-${lowPct}%`;
        parts.push(`Normal ${fmtNum(nom * (1 - lowPct / 100), 0)}-${fmtNum(nom * (1 + rule.warningPct / 100), 0)}${u} (nominal ${fmtNum(nom, 0)}${u} ${tol})`);
      }
      if (rule.alarmPct !== undefined) {
        parts.push(`kritis di luar ${fmtNum(nom * (1 - rule.alarmPct / 100), 0)}-${fmtNum(nom * (1 + rule.alarmPct / 100), 0)}${u} (${fromNameplate ? 'rating nameplate' : 'nominal'} ${fmtNum(nom, 0)}${u} ±${rule.alarmPct}%)`);
      }
      return parts.join('; ');
    }
    case 'upper':
      return [
        rule.watch !== undefined ? `pantau >${fmtNum(rule.watch)}${u}` : '',
        `peringatan >${fmtNum(rule.warning)}${u}`,
        rule.alarm !== undefined ? `kritis >${fmtNum(rule.alarm)}${u}` : '',
      ].filter(Boolean).join('; ');
    case 'pctOfRatedCurrent': {
      const fla = np.ratedCurrent;
      if (!fla || fla <= 0) return '';
      return [
        rule.watchPct !== undefined ? `pantau >${fmtNum(fla * rule.watchPct / 100)}${u}` : '',
        `peringatan >${fmtNum(fla * rule.warningPct / 100)}${u}`,
        rule.alarmPct !== undefined ? `kritis >${fmtNum(fla * rule.alarmPct / 100)}${u}` : '',
      ].filter(Boolean).join('; ') + ` (FLA nameplate ${fmtNum(fla)}${u})`;
    }
    case 'range':
      return `Normal ${fmtNum(rule.lowWarning ?? rule.lowAlarm)}-${fmtNum(rule.highWatch ?? rule.highWarning)}${u}`
        + (rule.highWarning !== undefined ? `; peringatan >${fmtNum(rule.highWarning)}${u}` : '')
        + (rule.highAlarm !== undefined ? `; kritis >${fmtNum(rule.highAlarm)}${u}` : '');
    case 'dropFromBaseline':
      return baseline !== null
        ? `Turun >${rule.watchPct}% dari acuan awal ${fmtNum(baseline)}${u} = pantau; >${rule.warningPct}% = peringatan`
        : `Pengukuran pertama menjadi acuan; turun >${rule.watchPct}% pada pengukuran berikutnya = pantau`;
    case 'changeFromBaseline':
      return baseline !== null
        ? `Berubah >${rule.watchPct}% dari acuan awal ${fmtNum(baseline)}${u} = pantau; >${rule.warningPct}% = peringatan`
        : `Pengukuran pertama menjadi acuan; berubah >${rule.watchPct}% pada pengukuran berikutnya = pantau`;
    case 'riseFromPrevious':
      return `naik >=${fmtNum(rule.watch)}${u} dari periode sebelumnya = pantau`;
    case 'nonNegative':
      return '';
  }
}

export interface EvaluateInput {
  param: string;
  def: PmParamDef;
  series: PmSeriesPoint[]; // termasuk titik laporan ini (bila ada nilainya)
  value: number | null;
  date: string;
  nameplate: PmNameplate;
}

/** Status, perubahan, tren, dan proyeksi satu parameter. */
export function evaluateParam({ param, def, series, value, date, nameplate }: EvaluateInput): PmParamResult {
  const unit = def.unit;
  const earlier = series.filter(p => p.date < date);
  const previous = earlier.length ? earlier[earlier.length - 1] : null;
  const baseline = earlier.length ? earlier[0].value : null;
  const points = value === null ? earlier.length : earlier.length + 1;
  const notes: string[] = [];

  const base: PmParamResult = {
    param, label: def.label, unit, value, status: 'unknown', limitText: '', points, previous,
    change: null, changePct: null, trendPerQuarter: null, projection: null, confidence: 'Rendah', note: '',
  };

  // Aturan berbasis FLA hanya berlaku bila nameplate memuat arus nominal; parameter tanpa
  // aturan yang berlaku (mis. tekanan supply/return) dinilai lewat parameter turunannya.
  const rules = def.rules.filter(r => r.type !== 'pctOfRatedCurrent' || (nameplate.ratedCurrent ?? 0) > 0);
  base.limitText = rules.map(r => ruleText(r, unit, nameplate, baseline)).filter(Boolean).join('; ');

  if (value === null) {
    base.note = def.derived === 'currentLoadPct'
      ? 'FLA nameplate tidak tersedia; beban terhadap rating belum dapat dihitung.'
      : 'Nilai tidak tersedia pada laporan ini.';
    return base;
  }

  // Status dari aturan absolut / relatif.
  let status: PmStatus = rules.length ? 'normal' : 'unknown';
  const allLimits: Limit[] = [];
  for (const rule of rules) {
    if (rule.type === 'nonNegative') {
      if (value < 0) {
        status = STATUS_RANK.warning > STATUS_RANK[status] ? 'warning' : status;
        notes.push('Nilai negatif: tekanan return lebih tinggi dari supply, periksa pembacaan gauge atau arah aliran.');
      }
      continue;
    }
    if (rule.type === 'riseFromPrevious') {
      if (previous) {
        const rise = value - previous.value;
        const s: PmStatus = rule.warning !== undefined && rise >= rule.warning ? 'warning' : rise >= rule.watch ? 'watch' : 'normal';
        if (STATUS_RANK[s] > STATUS_RANK[status]) status = s;
        if (s !== 'normal') notes.push(`Naik ${fmtNum(rise)} ${unit} dari periode sebelumnya.`);
      }
      continue;
    }
    if ((rule.type === 'dropFromBaseline' || rule.type === 'changeFromBaseline') && baseline === null) {
      notes.push('Titik data pertama, menjadi baseline unit ini.');
      continue;
    }
    const limits = limitsOf(rule, nameplate, baseline);
    allLimits.push(...limits);
    const s = statusFromLimits(value, limits);
    if (STATUS_RANK[s] > STATUS_RANK[status]) status = s;
  }
  base.status = status;

  // Perubahan & tren.
  if (previous) {
    base.change = Number((value - previous.value).toFixed(4));
    base.changePct = previous.value !== 0 ? Number(((value - previous.value) / Math.abs(previous.value) * 100).toFixed(2)) : null;
  }
  const trendSeries = [...earlier, { date, value, reportId: 'current' }];
  const trend = linearTrend(trendSeries);
  if (!trend) {
    if (!previous) notes.push('Pengukuran baseline; tren dihitung mulai laporan berikutnya.');
  } else {
    const perQuarter = trend.slopePerDay * QUARTER_DAYS;
    base.trendPerQuarter = Number(perQuarter.toFixed(4));
    const mean = trendSeries.reduce((a, p) => a + p.value, 0) / trendSeries.length;
    const stable = Math.abs(perQuarter) < Math.max(Math.abs(mean) * 0.01, 1e-6);
    base.confidence = trendSeries.length >= 4 && trend.r2 >= 0.7 ? 'Tinggi' : trendSeries.length >= 3 ? 'Sedang' : 'Rendah';
    if (stable) {
      notes.push('Tren stabil.');
    } else {
      notes.push(`Tren ${perQuarter > 0 ? 'naik' : 'turun'} ${fmtNum(Math.abs(perQuarter))} ${unit}/kuartal (${trendSeries.length} titik data).`);
      base.projection = projectToLimit(value, trend.slopePerDay, date, allLimits, status);
      if (base.projection) {
        notes.push(`Diperkirakan mencapai batas ${base.projection.level === 'alarm' ? 'kritis' : 'peringatan'} ${fmtNum(base.projection.limit)} ${unit} sekitar ${fmtMonthYear(base.projection.date)} (keyakinan ${base.confidence.toLowerCase()}).`);
      }
    }
  }
  base.note = notes.join(' ');
  return base;
}

/** Tanggal perkiraan nilai menembus batas berikutnya searah tren (null bila >3 tahun / tidak searah). */
export function projectToLimit(value: number, slopePerDay: number, date: string, limits: Limit[], status: PmStatus): PmProjection | null {
  if (!slopePerDay) return null;
  const targetLevels: ('warning' | 'alarm')[] = STATUS_RANK[status] >= STATUS_RANK.alarm ? [] : STATUS_RANK[status] >= STATUS_RANK.warning ? ['alarm'] : ['warning', 'alarm'];
  let best: PmProjection | null = null;
  for (const l of limits) {
    if (l.level === 'watch' || !targetLevels.includes(l.level)) continue;
    const towards = l.side === 'above' ? slopePerDay > 0 && value < l.value : slopePerDay < 0 && value > l.value;
    if (!towards) continue;
    const days = Math.abs((l.value - value) / slopePerDay);
    if (days > MAX_PROJECTION_DAYS) continue;
    if (!best || days < best.daysAhead) {
      best = { level: l.level, limit: Number(l.value.toFixed(3)), date: addDays(date, days), daysAhead: Math.round(days) };
    }
  }
  return best;
}

export function worstStatus(statuses: PmStatus[]): PmStatus {
  const known = statuses.filter(s => s !== 'unknown');
  if (!known.length) return 'unknown';
  return known.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), 'normal' as PmStatus);
}

export function visualStatus(condition: PmVisualObservation['condition']): PmStatus {
  if (condition === 'baik') return 'normal';
  if (condition === 'perlu perhatian') return 'watch';
  if (condition === 'buruk') return 'warning';
  return 'unknown';
}

export function effectiveStatus(section: PmEquipmentSection): PmStatus {
  return section.statusOverride || section.status;
}

/** Label status untuk narasi & AI; null bila tidak ada batas acuan untuk dinilai. */
export function knownStatusLabel(status: PmStatus): string | null {
  return status === 'unknown' ? null : STATUS_LABEL[status];
}

// ─── Susun bagian per equipment ──────────────────────────────────────────────

export const EMPTY_NARRATIVE: PmSectionNarrative = { kondisi: '', analisisTren: '', prediksiRisiko: '', rekomendasi: [] };

export function buildSections(
  profile: PmProfile,
  values: Record<string, number | null>,
  history: PmHistory,
  visuals: PmVisualObservation[],
  date: string,
  nameplate: PmNameplate,
): PmEquipmentSection[] {
  const sections: PmEquipmentSection[] = profile.equipment.map(eq => {
    const params = eq.params
      .filter(p => profile.params[p])
      .map(p => evaluateParam({ param: p, def: profile.params[p], series: history[p] || [], value: values[p] ?? null, date, nameplate }))
      // Parameter tanpa angka sama sekali (tidak ada di laporan & riwayat) tidak ditampilkan.
      .filter(r => r.value !== null || r.points > 0 || profile.params[r.param].derived === 'currentLoadPct');
    const eqVisuals = visuals.filter(v => eq.visualKeys?.includes(v.key));
    const status = worstStatus([...params.map(p => p.status), ...eqVisuals.map(v => visualStatus(v.condition))]);
    return { id: eq.id, name: eq.name, role: eq.role, status, params, visuals: eqVisuals, narrative: { ...EMPTY_NARRATIVE }, narrativeSource: 'otomatis' as const };
  }).filter(s => s.params.some(p => p.value !== null) || s.visuals.length);

  const otherVisuals = visuals.filter(v => !profile.equipment.some(eq => eq.visualKeys?.includes(v.key)));
  if (otherVisuals.length) {
    sections.push({
      id: 'other', name: 'Observasi Visual Lainnya', role: 'Kartu dokumentasi lain pada laporan PM yang dinilai secara visual.',
      status: worstStatus(otherVisuals.map(v => visualStatus(v.condition))), params: [], visuals: otherVisuals,
      narrative: { ...EMPTY_NARRATIVE }, narrativeSource: 'otomatis',
    });
  }
  return sections;
}

// ─── Narasi cadangan (bila AI tidak tersedia) ────────────────────────────────

export function fallbackNarrative(section: PmEquipmentSection): PmSectionNarrative {
  const withValue = section.params.filter(p => p.value !== null);
  const flagged = withValue.filter(p => STATUS_RANK[p.status] >= STATUS_RANK.watch);
  const sectionStatus = knownStatusLabel(effectiveStatus(section));
  const kondisi = withValue.length
    ? `${section.name}${sectionStatus ? ` berstatus ${sectionStatus}` : ''}. ` + withValue
      .map(p => `${p.label} ${fmtNum(p.value)} ${p.unit}${knownStatusLabel(p.status) ? ` (${knownStatusLabel(p.status)})` : ''}`).join(', ') + '.'
    : `${section.name} dinilai dari observasi visual: ` + section.visuals.map(v => `${v.cardLabel} ${v.condition}${v.observation ? ` (${v.observation})` : ''}`).join('; ') + '.';
  const trended = withValue.filter(p => p.trendPerQuarter !== null);
  const analisisTren = trended.length
    ? trended.map(p => `${p.label}: ${p.note}`).join(' ')
    : 'Pengukuran ini menjadi data awal (baseline); tren dihitung mulai pengukuran periode berikutnya.';
  const projected = withValue.filter(p => p.projection);
  const prediksiRisiko = projected.length
    ? projected.map(p => `${p.label} diperkirakan mencapai batas ${p.projection!.level === 'alarm' ? 'kritis' : 'peringatan'} ${fmtNum(p.projection!.limit)} ${p.unit} sekitar ${fmtMonthYear(p.projection!.date)} (keyakinan ${p.confidence.toLowerCase()}).`).join(' ')
    : 'Tidak ada parameter yang trennya mengarah ke batas acuan dalam 3 tahun ke depan berdasarkan data yang tersedia.';
  const rekomendasi = flagged.length
    ? flagged.map(p => `Verifikasi ${p.label.toLowerCase()} (${fmtNum(p.value)} ${p.unit}) dan telusuri penyebabnya sebelum PM berikutnya.`)
    : ['Lanjutkan preventive maintenance sesuai jadwal dan pertahankan pengukuran pada titik yang sama agar tren tetap sebanding.'];
  return { kondisi, analisisTren, prediksiRisiko, rekomendasi };
}

export function fallbackSummary(unitLabel: string, sections: PmEquipmentSection[]): { ringkasan: string; prioritas: string[] } {
  const overall = worstStatus(sections.map(effectiveStatus));
  const flagged = sections.filter(s => STATUS_RANK[effectiveStatus(s)] >= STATUS_RANK.watch);
  const ringkasan = (overall === 'unknown' ? `Hasil pengukuran unit ${unitLabel} tercatat sebagai data awal pemantauan. ` : `Unit ${unitLabel} secara keseluruhan berstatus ${STATUS_LABEL[overall]}. `)
    + (flagged.length
      ? `Equipment yang perlu perhatian: ${flagged.map(s => `${s.name} (${STATUS_LABEL[effectiveStatus(s)]})`).join(', ')}.`
      : 'Seluruh equipment yang diukur berada dalam batas acuan.');
  const prioritas = flagged.flatMap(s => s.narrative.rekomendasi.slice(0, 1));
  return { ringkasan, prioritas: prioritas.length ? prioritas : ['Lanjutkan preventive maintenance sesuai jadwal.'] };
}

// ─── Data untuk AI ───────────────────────────────────────────────────────────

/** Ringkas satu bagian menjadi DATA untuk narasi AI (angka sudah final). */
export function sectionAIContext(unit: { unitType: string; unitLabel: string; maintenanceName: string; date: string; nameplate: PmNameplate }, section: PmEquipmentSection) {
  return {
    unit: {
      jenis: unit.unitType,
      nama: unit.unitLabel,
      laporanPM: unit.maintenanceName,
      tanggalPM: unit.date,
      nameplate: unit.nameplate,
    },
    equipment: { nama: section.name, fungsi: section.role, status: knownStatusLabel(effectiveStatus(section)) },
    // Parameter tanpa angka tidak dicetak di laporan, jadi tidak dikirim ke AI.
    parameter: section.params.filter(p => p.value !== null).map(p => ({
      nama: p.label,
      satuan: p.unit,
      nilai: p.value,
      status: knownStatusLabel(p.status),
      batasAcuan: p.limitText || null,
      jumlahTitikData: p.points,
      sebelumnya: p.previous ? { tanggal: p.previous.date, nilai: p.previous.value } : null,
      perubahan: p.change,
      perubahanPersen: p.changePct,
      trenPerKuartal: p.trendPerQuarter,
      proyeksi: p.projection
        ? `Mencapai batas ${p.projection.level === 'alarm' ? 'kritis' : 'peringatan'} ${fmtNum(p.projection.limit)} ${p.unit} sekitar ${fmtMonthYear(p.projection.date)} (keyakinan ${p.confidence.toLowerCase()})`
        : null,
      catatanSistem: p.note,
    })),
    observasiVisual: section.visuals.map(v => ({ kartu: v.cardLabel, kondisi: v.condition, observasi: v.observation })),
  };
}

export function summaryAIContext(unit: { unitType: string; unitLabel: string; date: string }, sections: PmEquipmentSection[]) {
  return {
    unit: { jenis: unit.unitType, nama: unit.unitLabel, tanggalPM: unit.date, statusKeseluruhan: knownStatusLabel(worstStatus(sections.map(effectiveStatus))) },
    equipment: sections.map(s => ({
      nama: s.name,
      status: knownStatusLabel(effectiveStatus(s)),
      kondisi: s.narrative.kondisi,
      prediksi: s.narrative.prediksiRisiko,
      rekomendasiUtama: s.narrative.rekomendasi.slice(0, 2),
    })),
  };
}
