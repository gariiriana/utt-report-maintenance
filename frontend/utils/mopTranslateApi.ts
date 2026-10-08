// ============================================================================
// FILE: frontend/utils/mopTranslateApi.ts
// Deskripsi: Pemanggil endpoint backend /api/mop/translate (AI tier gratis)
//            untuk menerjemahkan segmen MOP EN -> ID. Seluruh segmen dikirim
//            sebagai konteks; terjemahan diminta per kelompok agar tiap panggilan
//            muat dalam batas waktu server.
// ============================================================================

import { auth } from '@/api/firebase';
import { getApiEndpoint } from '@/utils/apiConfig';

// 25 paragraf per panggilan selesai dalam ~3-15 detik, jauh di bawah batas 55 detik backend.
// Paralel 2 menjaga jumlah permintaan per menit di bawah kuota tier gratis.
const BATCH_SIZE = 25;
const PARALLEL = 2;
const RATE_LIMIT_WAIT_MS = 20_000;

export interface MOPTranslateResult {
  translations: Record<string, string>; // kunci: teks Inggris; '' = sengaja tidak diterjemahkan (nama/kode)
  warnings: Record<string, string>;     // kunci: teks Inggris; alasan hasil perlu dicek manusia
  failed: string[];                       // teks yang tidak berhasil diterjemahkan
  lastError?: string;
}

async function requestBatch(title: string, segments: string[], indices: number[]) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login diperlukan untuk menerjemahkan.');
  const token = await user.getIdToken();

  const response = await fetch(getApiEndpoint('/api/mop/translate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, segments, indices }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !Array.isArray(payload.translations)) {
    const error = new Error(payload?.message || `Penerjemahan gagal (HTTP ${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload.translations as Array<{ index: number; text: string; warning?: string }>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Terjemahkan `targets` (subset dari `segments`). Kelompok pertama dijalankan sendiri
 * supaya konteks dokumen ter-cache di server, sisanya paralel terbatas.
 * Error konfigurasi/izin (401/403/503) langsung dilempar; kelompok lain yang gagal dicoba sekali lagi,
 * dengan jeda bila kuota per menit AI gratis sedang penuh (429).
 */
export async function translateMOPSegments(
  title: string,
  segments: string[],
  targets: string[],
  onProgress?: (done: number, total: number) => void
): Promise<MOPTranslateResult> {
  const indexOf = new Map(segments.map((s, i) => [s, i]));
  const targetIndices = targets.map(t => indexOf.get(t)).filter((i): i is number => i !== undefined);
  const batches: number[][] = [];
  for (let i = 0; i < targetIndices.length; i += BATCH_SIZE) batches.push(targetIndices.slice(i, i + BATCH_SIZE));

  const translations: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  let done = 0;
  let lastError: string | undefined;

  const runBatch = async (indices: number[]) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await requestBatch(title, segments, indices);
        for (const t of result) {
          const source = segments[t.index];
          if (source === undefined) continue;
          translations[source] = (t.text || '').trim();
          if (t.warning) warnings[source] = t.warning;
          else delete warnings[source];
        }
        return;
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403 || status === 503) throw err;
        lastError = err instanceof Error ? err.message : String(err);
        if (status === 429 && attempt < 2) await sleep(RATE_LIMIT_WAIT_MS);
      }
    }
  };

  const advance = (count: number) => {
    done += count;
    onProgress?.(done, targetIndices.length);
  };

  if (batches.length > 0) {
    await runBatch(batches[0]);
    advance(batches[0].length);
  }
  const rest = batches.slice(1);
  for (let i = 0; i < rest.length; i += PARALLEL) {
    const group = rest.slice(i, i + PARALLEL);
    await Promise.all(group.map(async b => {
      await runBatch(b);
      advance(b.length);
    }));
  }

  const failed = targets.filter(t => !(t in translations));
  return { translations, warnings, failed, lastError };
}
