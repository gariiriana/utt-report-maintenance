// ============================================================================
// FILE: frontend/utils/pmPredictiveService.ts
// Deskripsi: Lapisan data Predictive Report dari laporan PM.
//            - Muat foto kartu laporan PM (IndexedDB lokal dulu, lalu Firestore).
//            - Panggil AI backend: baca foto per batch, narasi per equipment, ringkasan.
//            - Cari predictive sebelumnya untuk unit yang sama (sumber riwayat tren).
//            - Simpan ke koleksi pm_predictive_reports (id = id laporan PM).
// ============================================================================

import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, serverTimestamp, getDocsFromCache } from 'firebase/firestore';
import { db, auth } from '@/api/firebase';
import { getApiEndpoint } from '@/utils/apiConfig';
import { offlineReportStorage } from '@/utils/offlineReportStorage';
import { compressBase64Image } from '@/utils/imageCompression';
import type { PmExtractResult, PmPredictiveReport, PmSectionNarrative, PmCardKind } from '@/types/pmPredictiveTypes';

export const PM_PREDICTIVE_COLLECTION = 'pm_predictive_reports';

export interface PmSourcePhoto {
  index: number;
  description: string;
  photoBase64: string;
}

export interface PmExtractRequestItem {
  index: number;
  label: string;
  kind: PmCardKind;
  expected?: string;
  unit?: string;
  imageBase64: string;
}

// ─── Foto laporan PM ─────────────────────────────────────────────────────────

function toDataURL(b64: string): string {
  if (!b64) return '';
  if (b64.startsWith('data:image')) return b64;
  return `data:image/${b64.startsWith('iVBOR') ? 'png' : 'jpeg'};base64,${b64}`;
}

/** Foto kartu laporan PM, urut index; IndexedDB lokal dulu agar hemat kuota Firestore. */
export async function loadPmSourcePhotos(docId: string, collectionName = 'pdf_documents'): Promise<PmSourcePhoto[]> {
  let rows: { index: number; description?: string; photoBase64?: string }[] = [];
  try {
    rows = await offlineReportStorage.getPhotos(docId);
  } catch {
    rows = [];
  }
  if (!rows.some(r => r.photoBase64)) {
    const colRef = collection(db, `${collectionName}/${docId}/photos`);
    const snap = navigator.onLine
      ? await getDocs(colRef).catch(() => getDocsFromCache(colRef))
      : await getDocsFromCache(colRef);
    rows = snap.docs.map(d => d.data() as any);
  }
  // Sinkron ulang lama kadang menggandakan foto; satu foto per index.
  const byIndex = new Map<number, PmSourcePhoto>();
  for (const r of rows) {
    if (!r.photoBase64) continue;
    byIndex.set(Number(r.index), { index: Number(r.index), description: (r.description || '').trim(), photoBase64: toDataURL(r.photoBase64) });
  }
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

/** Perkecil foto untuk AI: cukup tajam untuk digit 7-segmen, tetap di bawah batas body Vercel. */
export async function prepareImageForAI(dataUrl: string): Promise<string> {
  // Foto laporan PM umumnya sudah JPEG terkompres saat disimpan; kompres ulang hanya
  // menambah artefak pada digit display, jadi yang sudah kecil dikirim apa adanya.
  if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 900_000) return dataUrl;
  try {
    let out = await compressBase64Image(dataUrl, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
    if (out.length > 1_200_000) out = await compressBase64Image(dataUrl, { maxWidth: 1024, maxHeight: 1024, quality: 0.7 });
    return out;
  } catch {
    return dataUrl;
  }
}

// ─── Panggilan AI backend ────────────────────────────────────────────────────

export class PmAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PmAIError';
    this.status = status;
  }
}

async function postAI<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new PmAIError('Sesi login berakhir, silakan login ulang.', 401);
  const send = async () => {
    const res = await fetch(getApiEndpoint(path), {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new PmAIError(payload.message || payload.error || `Layanan AI error (${res.status})`, res.status);
    return payload as T;
  };
  try {
    return await send();
  } catch (err) {
    // Kuota per menit / fungsi server kehabisan waktu: coba sekali lagi setelah jeda.
    if (err instanceof PmAIError && [429, 502, 503, 504].includes(err.status)) {
      await new Promise(r => setTimeout(r, 6000));
      return send();
    }
    throw err;
  }
}

const EXTRACT_MAX_ITEMS = 6;
const EXTRACT_MAX_CHARS = 3_000_000;

/** Bagi foto ke beberapa panggilan agar tiap panggilan muat batas ukuran & waktu server. */
export function batchExtractItems(items: PmExtractRequestItem[]): PmExtractRequestItem[][] {
  const batches: PmExtractRequestItem[][] = [];
  let cur: PmExtractRequestItem[] = [];
  let size = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= EXTRACT_MAX_ITEMS || size + it.imageBase64.length > EXTRACT_MAX_CHARS)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += it.imageBase64.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export async function extractBatchAI(unitType: string, unitLabel: string, items: PmExtractRequestItem[]): Promise<PmExtractResult[]> {
  const res = await postAI<{ items: PmExtractResult[] }>('/api/ai/pm-predictive/extract', { unitType, unitLabel, items });
  return res.items || [];
}

export async function analyzeSectionAI(context: unknown): Promise<PmSectionNarrative> {
  const res = await postAI<{ result: PmSectionNarrative }>('/api/ai/pm-predictive/analyze', { mode: 'section', context });
  return {
    kondisi: res.result?.kondisi || '',
    analisisTren: res.result?.analisisTren || '',
    prediksiRisiko: res.result?.prediksiRisiko || '',
    rekomendasi: Array.isArray(res.result?.rekomendasi) ? res.result.rekomendasi : [],
  };
}

export async function analyzeSummaryAI(context: unknown): Promise<{ ringkasan: string; prioritas: string[] }> {
  const res = await postAI<{ result: { ringkasan: string; prioritas: string[] } }>('/api/ai/pm-predictive/analyze', { mode: 'summary', context });
  return { ringkasan: res.result?.ringkasan || '', prioritas: Array.isArray(res.result?.prioritas) ? res.result.prioritas : [] };
}

// ─── Firestore ───────────────────────────────────────────────────────────────

export async function getPmPredictive(sourceDocId: string): Promise<PmPredictiveReport | null> {
  const snap = await getDoc(doc(db, PM_PREDICTIVE_COLLECTION, sourceDocId));
  return snap.exists() ? ({ ...(snap.data() as PmPredictiveReport), id: snap.id }) : null;
}

/**
 * Predictive terakhir untuk unit yang sama yang tanggal PM-nya lebih awal dari
 * laporan ini. Satu query equality (tanpa index komposit); jumlah dokumen per unit
 * kecil (sekitar 4 per tahun).
 */
export async function findPreviousPmPredictive(unitKey: string, maintenanceDate: string, excludeId: string): Promise<{ previous: PmPredictiveReport | null; total: number; newerExists: boolean }> {
  const snap = await getDocs(query(collection(db, PM_PREDICTIVE_COLLECTION), where('unitKey', '==', unitKey)));
  const reports = snap.docs
    .map(d => ({ ...(d.data() as PmPredictiveReport), id: d.id }))
    .filter(r => r.id !== excludeId);
  const earlier = reports.filter(r => r.maintenanceDate < maintenanceDate).sort((a, b) => a.maintenanceDate.localeCompare(b.maintenanceDate));
  return {
    previous: earlier.length ? earlier[earlier.length - 1] : null,
    total: reports.length,
    newerExists: reports.some(r => r.maintenanceDate > maintenanceDate),
  };
}

/** Firestore menolak field undefined; buang sebelum disimpan. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(v => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function savePmPredictive(report: PmPredictiveReport, isNew: boolean): Promise<void> {
  const { createdAt, updatedAt: _updatedAt, ...rest } = report;
  // Tulis penuh (bukan merge) agar parameter yang hilang saat generate ulang tidak tertinggal di history.
  await setDoc(doc(db, PM_PREDICTIVE_COLLECTION, report.id), {
    ...stripUndefined(rest),
    createdAt: isNew || !createdAt ? serverTimestamp() : createdAt,
    updatedAt: serverTimestamp(),
  });

  // Penanda kecil di laporan PM agar Arsip Dokumen bisa menampilkan status tanpa baca ulang.
  try {
    await updateDoc(doc(db, report.sourceCollection, report.sourceDocId), {
      pmPredictive: { reportNumber: report.reportNumber, overallStatus: report.overallStatus, updatedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.warn('Gagal menandai laporan PM dengan status predictive:', err);
  }
}
