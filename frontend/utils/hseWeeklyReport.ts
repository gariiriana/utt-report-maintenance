// ============================================================================
// FILE: hseWeeklyReport.ts
// Deskripsi: Mengolah data mingguan HSE (Inspeksi, Absen TBM, Safety Induction,
//            Temuan K3) menjadi satu ringkasan siap diekspor ke Excel.
//            Modul murni (tanpa Firebase / DOM) agar bisa diuji dengan
//            `node --test scripts/test-hse-weekly-report.mjs`.
// ============================================================================

export const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export interface HSEWeekRange {
  start: string;   // Senin, YYYY-MM-DD
  end: string;     // Minggu, YYYY-MM-DD
  days: string[];  // 7 tanggal Senin..Minggu
  isoWeek: number;
  isoYear: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const parseYmdUTC = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const ymdFromUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(ymd: string, n: number): string {
  const d = parseYmdUTC(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return ymdFromUTC(d);
}

export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Minggu kerja Senin–Minggu (ISO 8601) yang memuat tanggal `ymd`. */
export function getWeekRange(ymd: string): HSEWeekRange {
  const dow = (parseYmdUTC(ymd).getUTCDay() + 6) % 7; // Senin = 0
  const start = addDays(ymd, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // Tahun & nomor minggu ISO ditentukan oleh hari Kamis di minggu tersebut
  const thursday = parseYmdUTC(days[3]);
  const isoYear = thursday.getUTCFullYear();
  const isoWeek = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000 / 7) + 1;
  return { start, end: days[6], days, isoWeek, isoYear };
}

/** "Sen, 12 Okt" */
export function formatDayLabel(ymd: string): string {
  const d = parseYmdUTC(ymd);
  return `${DAY_SHORT[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "12 Okt 2026" atau "12 Oktober 2026" */
export function formatDate(ymd: string, long = false): string {
  const d = parseYmdUTC(ymd);
  return `${d.getUTCDate()} ${(long ? MONTH_LONG : MONTH_SHORT)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "12 – 18 Okt 2026", "28 Sep – 4 Okt 2026", "29 Des 2025 – 4 Jan 2026" */
export function formatWeekLabel(week: HSEWeekRange): string {
  const s = parseYmdUTC(week.start);
  const e = parseYmdUTC(week.end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  const left = sameMonth
    ? `${s.getUTCDate()}`
    : sameYear
      ? `${s.getUTCDate()} ${MONTH_SHORT[s.getUTCMonth()]}`
      : formatDate(week.start);
  return `${left} – ${formatDate(week.end)}`;
}

/**
 * Normalisasi berbagai format tanggal Firestore ke YYYY-MM-DD waktu lokal.
 * Inspeksi menyimpan ISO UTC (`toISOString()`), TBM/Induction/Temuan menyimpan YYYY-MM-DD.
 */
export function toLocalYmd(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = toDate(raw);
  return d ? todayYmd(d) : null;
}

function toDate(raw: unknown): Date | null {
  let d: Date | null = null;
  if (raw instanceof Date) d = raw;
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw && typeof (raw as any).toDate === 'function') d = (raw as any).toDate();
  else if (raw && typeof (raw as any).seconds === 'number') d = new Date((raw as any).seconds * 1000);
  return d && !isNaN(d.getTime()) ? d : null;
}

function localTime(raw: unknown): string {
  if (typeof raw !== 'string' || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const d = toDate(raw);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const norm = (v: unknown) => text(v).toLowerCase().replace(/\s+/g, ' ');

// ============================================================================
// TIPE DATA HASIL OLAHAN
// ============================================================================

export const INSPECTION_CHECKS = [
  { key: 'mop', label: 'MOP' },
  { key: 'jsa', label: 'JSA' },
  { key: 'ptw', label: 'PTW' },
  { key: 'loto', label: 'LOTO' },
  { key: 'apd', label: 'APD' },
] as const;
export type InspectionCheckKey = typeof INSPECTION_CHECKS[number]['key'];

export interface HSEWeeklyInspection {
  id: string;
  date: string;
  time: string;
  aktivitas: string;
  lokasi: string;
  pic: string;
  checks: Record<InspectionCheckKey, boolean>;
}

export interface HSEWeeklyTbm {
  id: string;
  date: string;
  time: string;
  lokasi: string;
  totalSDM: number;
  keterangan: string;
}

export interface HSEWeeklyInductionParticipant {
  nama: string;
  perusahaan: string;
  jabatan: string;
}

export interface HSEWeeklyInduction {
  id: string;
  date: string;
  time: string;
  participants: HSEWeeklyInductionParticipant[];
}

export interface HSEWeeklyFinding {
  id: string;
  date: string;
  time: string;
  type: 'negative' | 'positive';
  classification: string;  // Unsafe Action, Safe Behavior, dst.
  category: string;        // kategori bebas dari form
  title: string;
  description: string;
  location: string;
  targetPerson: string;
  status: 'open' | 'close';
  followUp: string;        // catatan tindak lanjut (afterNotes)
}

export interface HSEWeeklyDailyRow {
  key: 'inspection' | 'tbmSessions' | 'tbmAttendance' | 'induction' | 'negative' | 'positive';
  label: string;
  perDay: number[]; // 7 angka Senin..Minggu
  total: number;
}

export interface HSEWeeklySummary {
  inspections: number;
  inspectedLocations: number;
  tbmSessions: number;
  tbmDays: number;
  tbmAttendance: number;
  tbmAverage: number;
  inductionSessions: number;
  inductionParticipants: number;
  inductionCompanies: number;
  negative: number;
  unsafeAction: number;
  unsafeCondition: number;
  positive: number;
  negativeOpen: number;
  negativeClosed: number;
  carryOverOpen: number;
  totalOpen: number;
  /** % temuan negatif minggu ini yang sudah close; null bila tidak ada temuan negatif */
  closeRate: number | null;
  checkCounts: Record<InspectionCheckKey, number>;
}

export interface HSEWeeklyReport {
  week: HSEWeekRange;
  inspections: HSEWeeklyInspection[];
  tbm: HSEWeeklyTbm[];
  inductions: HSEWeeklyInduction[];
  findings: HSEWeeklyFinding[];
  carryOverFindings: HSEWeeklyFinding[];
  daily: HSEWeeklyDailyRow[];
  summary: HSEWeeklySummary;
}

export interface RawDoc {
  id: string;
  [key: string]: any;
}

// ============================================================================
// NORMALISASI PER JENIS DOKUMEN
// ============================================================================

const CLASSIFICATION_LABELS: Record<string, string> = {
  unsafe_action: 'Unsafe Action',
  unsafe_act: 'Unsafe Action',
  unsafe_condition: 'Unsafe Condition',
  safe_behavior: 'Safe Behavior',
  safe_condition: 'Safe Condition',
  compliance: 'Kepatuhan K3',
  best_practice: 'Best Practice',
  critical: 'Risiko Kritis',
  high: 'Risiko Tinggi',
  medium: 'Risiko Sedang',
  low: 'Risiko Rendah',
};

const byDateTime = (a: { date: string; time: string }, b: { date: string; time: string }) =>
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

function normalizeInspection(d: RawDoc, date: string): HSEWeeklyInspection {
  const cl = d.checklist || {};
  return {
    id: d.id,
    date,
    time: localTime(d.date),
    aktivitas: text(d.aktivitas) || 'Inspeksi K3',
    lokasi: text(d.lokasi) || '-',
    pic: text(d.pic) || text(d.personil) || '-',
    checks: {
      mop: !!cl.mop,
      jsa: !!cl.jsa,
      ptw: !!cl.ptw,
      loto: !!(cl.loto || cl.lockOut || cl.tagOut),
      apd: !!cl.ppe,
    },
  };
}

function normalizeTbm(d: RawDoc, date: string): HSEWeeklyTbm {
  return {
    id: d.id,
    date,
    time: text(d.time),
    lokasi: text(d.lokasi) || '-',
    totalSDM: Math.max(0, Number(d.totalSDM) || 0),
    keterangan: text(d.keterangan) || 'Toolbox Meeting & Safety Briefing',
  };
}

function normalizeInduction(d: RawDoc, date: string): HSEWeeklyInduction {
  const list: any[] = Array.isArray(d.pesertaList) && d.pesertaList.length > 0
    ? d.pesertaList
    : [{ nama: d.nama, perusahaan: d.perusahaan, jabatan: d.jabatan }];
  const participants = list
    .map(p => ({
      nama: text(p?.nama),
      perusahaan: text(p?.perusahaan) || '-',
      jabatan: text(p?.jabatan) || text(d.jabatan) || '-',
    }))
    .filter(p => p.nama);
  return { id: d.id, date, time: text(d.time), participants };
}

export function normalizeFinding(d: RawDoc): HSEWeeklyFinding | null {
  const date = toLocalYmd(d.findingDate);
  if (!date) return null;
  const type = d.findingType === 'positive' ? 'positive' : 'negative';
  const sev = text(d.severity);
  return {
    id: d.id,
    date,
    time: text(d.findingTime),
    type,
    classification: CLASSIFICATION_LABELS[sev] || sev || (type === 'positive' ? 'Temuan Positif' : 'Temuan Negatif'),
    category: text(d.category),
    title: text(d.title) || '-',
    description: text(d.description),
    location: text(d.location) || '-',
    targetPerson: text(d.targetPerson) === '-' ? '' : text(d.targetPerson),
    status: d.status === 'close' ? 'close' : 'open',
    followUp: text(d.afterNotes) || text(d.closingNotes),
  };
}

const isUnsafeAction = (f: HSEWeeklyFinding) => f.classification === 'Unsafe Action';
const isUnsafeCondition = (f: HSEWeeklyFinding) => f.classification === 'Unsafe Condition';

// ============================================================================
// SUSUN LAPORAN MINGGUAN
// ============================================================================

/**
 * @param hseDocs       dokumen koleksi `hse` (sudah dibatasi kira-kira ke minggu ini)
 * @param findingDocs   dokumen `hse_findings` dengan findingDate di minggu ini
 * @param openFindingDocs dokumen `hse_findings` berstatus open (untuk carry-over); kosongkan bila tidak dipakai
 */
export function buildHSEWeeklyReport(
  week: HSEWeekRange,
  hseDocs: RawDoc[],
  findingDocs: RawDoc[],
  openFindingDocs: RawDoc[] = [],
): HSEWeeklyReport {
  const inWeek = (ymd: string | null): ymd is string => !!ymd && ymd >= week.start && ymd <= week.end;
  const live = (d: RawDoc) => d.deleteRequested !== true;

  const inspections: HSEWeeklyInspection[] = [];
  const inspectionKeys = new Set<string>();
  const tbm: HSEWeeklyTbm[] = [];
  const inductions: HSEWeeklyInduction[] = [];

  // UTT dulu supaya saat ada duplikat (export PDF UTT + NeutraDC menyimpan 2 dokumen) yang UTT dipertahankan
  const sortedHse = [...hseDocs].filter(live).sort((a, b) =>
    Number(a.reportType !== 'utt') - Number(b.reportType !== 'utt'));

  for (const d of sortedHse) {
    const date = toLocalYmd(d.date);
    if (!inWeek(date)) continue;
    const hseType = d.hseType || 'inspection';
    if (hseType === 'tbm') {
      tbm.push(normalizeTbm(d, date));
    } else if (hseType === 'induction') {
      const ind = normalizeInduction(d, date);
      if (ind.participants.length > 0) inductions.push(ind);
    } else if (hseType === 'inspection') {
      const key = [date, norm(d.aktivitas), norm(d.lokasi), norm(d.pic), norm(d.authorEmail)].join('|');
      if (inspectionKeys.has(key)) continue;
      inspectionKeys.add(key);
      inspections.push(normalizeInspection(d, date));
    }
  }

  const findings = findingDocs
    .filter(live)
    .map(normalizeFinding)
    .filter((f): f is HSEWeeklyFinding => !!f && inWeek(f.date));

  const thisWeekIds = new Set(findings.map(f => f.id));
  const carryOverFindings = openFindingDocs
    .filter(live)
    .map(normalizeFinding)
    .filter((f): f is HSEWeeklyFinding =>
      !!f && f.type === 'negative' && f.status === 'open' && f.date < week.start && !thisWeekIds.has(f.id));

  inspections.sort(byDateTime);
  tbm.sort(byDateTime);
  inductions.sort(byDateTime);
  // Negatif dulu (prioritas tindak lanjut), lalu positif; masing-masing urut tanggal
  findings.sort((a, b) => Number(a.type === 'positive') - Number(b.type === 'positive') || byDateTime(a, b));
  carryOverFindings.sort(byDateTime);

  const dayIndex = (ymd: string) => week.days.indexOf(ymd);
  const makeRow = (key: HSEWeeklyDailyRow['key'], label: string, items: { date: string }[], weight: (i: any) => number = () => 1): HSEWeeklyDailyRow => {
    const perDay = Array(7).fill(0);
    for (const it of items) {
      const idx = dayIndex(it.date);
      if (idx >= 0) perDay[idx] += weight(it);
    }
    return { key, label, perDay, total: perDay.reduce((s, n) => s + n, 0) };
  };

  const negatives = findings.filter(f => f.type === 'negative');
  const positives = findings.filter(f => f.type === 'positive');

  const daily: HSEWeeklyDailyRow[] = [
    makeRow('inspection', 'Inspeksi HSE', inspections),
    makeRow('tbmSessions', 'Sesi TBM', tbm),
    makeRow('tbmAttendance', 'Kehadiran TBM (org)', tbm, (t: HSEWeeklyTbm) => t.totalSDM),
    makeRow('induction', 'Peserta Safety Induction', inductions, (i: HSEWeeklyInduction) => i.participants.length),
    makeRow('negative', 'Temuan Negatif', negatives),
    makeRow('positive', 'Temuan Positif', positives),
  ];

  const tbmAttendance = tbm.reduce((s, t) => s + t.totalSDM, 0);
  const allParticipants = inductions.flatMap(i => i.participants);
  const negativeClosed = negatives.filter(f => f.status === 'close').length;
  const negativeOpen = negatives.length - negativeClosed;

  const checkCounts = Object.fromEntries(
    INSPECTION_CHECKS.map(c => [c.key, inspections.filter(i => i.checks[c.key]).length]),
  ) as Record<InspectionCheckKey, number>;

  const summary: HSEWeeklySummary = {
    inspections: inspections.length,
    inspectedLocations: new Set(inspections.map(i => norm(i.lokasi)).filter(l => l && l !== '-')).size,
    tbmSessions: tbm.length,
    tbmDays: new Set(tbm.map(t => t.date)).size,
    tbmAttendance,
    tbmAverage: tbm.length ? Math.round((tbmAttendance / tbm.length) * 10) / 10 : 0,
    inductionSessions: inductions.length,
    inductionParticipants: allParticipants.length,
    inductionCompanies: new Set(allParticipants.map(p => norm(p.perusahaan)).filter(c => c && c !== '-')).size,
    negative: negatives.length,
    unsafeAction: negatives.filter(isUnsafeAction).length,
    unsafeCondition: negatives.filter(isUnsafeCondition).length,
    positive: positives.length,
    negativeOpen,
    negativeClosed,
    carryOverOpen: carryOverFindings.length,
    totalOpen: negativeOpen + carryOverFindings.length,
    closeRate: negatives.length ? Math.round((negativeClosed / negatives.length) * 100) : null,
    checkCounts,
  };

  return { week, inspections, tbm, inductions, findings, carryOverFindings, daily, summary };
}
