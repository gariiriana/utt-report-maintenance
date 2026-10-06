// ============================================================================
// FILE: frontend/utils/monthlyReportArchiveAssets.ts
// Deskripsi: Penyimpanan gambar (foto RCA, photo log, dll) arsip Monthly Report.
//            Satu dokumen Firestore maksimal 1 MiB, sedangkan laporan bisa berisi
//            ratusan foto. Sebelum arsip disimpan, setiap gambar besar dipindah ke
//            subkoleksi `monthly_reports/{id}/assets/{assetId}` (1 dokumen per gambar)
//            dan diganti referensi `asset://{assetId}`; saat arsip dibuka/diunduh,
//            referensi dikembalikan menjadi gambar.
// ============================================================================

import { collection, doc, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';

const ASSET_SUBCOLLECTION = 'assets';
const ASSET_REF_PREFIX = 'asset://';
// String di atas ukuran ini yang berupa gambar dipindah ke subkoleksi
const OFFLOAD_MIN_CHARS = 8_000;
// Batas aman isi satu dokumen aset (Firestore 1 MiB per dokumen)
const MAX_ASSET_CHARS = 900_000;
// Batas aman dokumen utama arsip setelah gambar dipindah
const MAX_MAIN_DOC_CHARS = 950_000;
// Satu commit batch dijaga jauh di bawah batas request Firestore (10 MiB / 500 operasi)
const BATCH_MAX_CHARS = 6_000_000;
const BATCH_MAX_OPS = 300;

const BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

function isImageString(value: string): boolean {
  if (value.startsWith('data:image')) return true;
  return value.length >= OFFLOAD_MIN_CHARS && BASE64_RE.test(value);
}

function toDataUrl(value: string): string {
  if (value.startsWith('data:')) return value;
  const mime = value.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${value.replace(/\s/g, '')}`;
}

/**
 * Perkecil gambar ke JPEG (sisi terpanjang `maxDim`). Kualitas diturunkan
 * bertahap sampai ukurannya di bawah `maxChars`. Gagal decode -> kembalikan apa adanya.
 */
export async function compressImageDataUrl(src: string, maxDim = 1280, maxChars = MAX_ASSET_CHARS): Promise<string> {
  if (!src) return src;
  const dataUrl = /^https?:/i.test(src) ? src : toDataUrl(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar'));
      el.src = dataUrl;
    });
    let dim = maxDim;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, dim / Math.max(img.naturalWidth || dim, img.naturalHeight || dim));
      const w = Math.max(1, Math.round((img.naturalWidth || dim) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || dim) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataUrl;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', attempt < 3 ? 0.78 - attempt * 0.12 : 0.5);
      if (out.length <= maxChars) return out;
      if (attempt >= 2) dim = Math.round(dim * 0.75);
    }
  } catch (err) {
    console.warn('[MonthlyReport] Kompres gambar gagal, dipakai apa adanya:', err);
  }
  return dataUrl;
}

async function hashString(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pindahkan semua gambar besar di `reportData` ke subkoleksi aset arsip `archiveId`,
 * hapus aset lama yang sudah tidak dipakai, dan kembalikan salinan laporan yang ringan.
 */
export async function offloadReportAssets<T>(archiveId: string, reportData: T): Promise<T> {
  const assets = new Map<string, string>();

  const walk = async (value: any): Promise<any> => {
    if (typeof value === 'string') {
      if (!isImageString(value)) return value;
      let content = value;
      if (content.length > MAX_ASSET_CHARS) {
        content = await compressImageDataUrl(content);
      }
      if (content.length > MAX_ASSET_CHARS) {
        throw new Error('Ada foto yang terlalu besar dan gagal dikompres untuk disimpan ke arsip.');
      }
      const id = await hashString(content);
      assets.set(id, content);
      return `${ASSET_REF_PREFIX}${id}`;
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const v of value) out.push(await walk(v));
      return out;
    }
    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[k] = await walk(v);
      return out;
    }
    return value;
  };

  const light = await walk(JSON.parse(JSON.stringify(reportData)));

  const mainSize = JSON.stringify(light).length;
  if (mainSize > MAX_MAIN_DOC_CHARS) {
    throw new Error(`Data laporan terlalu besar untuk satu dokumen arsip (${Math.round(mainSize / 1024)} KB).`);
  }

  const assetsCol = collection(db, 'monthly_reports', archiveId, ASSET_SUBCOLLECTION);
  const existingSnap = await getDocs(assetsCol);
  const existingIds = new Set(existingSnap.docs.map(d => d.id));

  // Tulis aset baru (yang sudah ada & isinya sama tidak ditulis ulang karena id = hash isi)
  let batch = writeBatch(db);
  let ops = 0;
  let chars = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
    chars = 0;
  };

  for (const [id, content] of assets) {
    if (existingIds.has(id)) continue;
    if (ops >= BATCH_MAX_OPS || chars + content.length > BATCH_MAX_CHARS) await commit();
    batch.set(doc(assetsCol, id), { data: content, createdAt: Timestamp.now() });
    ops++;
    chars += content.length;
  }
  for (const id of existingIds) {
    if (assets.has(id)) continue;
    if (ops >= BATCH_MAX_OPS) await commit();
    batch.delete(doc(assetsCol, id));
    ops++;
  }
  await commit();

  return light;
}

/** Kembalikan referensi `asset://` di laporan arsip menjadi gambar aslinya. */
export async function hydrateReportAssets<T>(archiveId: string, reportData: T): Promise<T> {
  if (!JSON.stringify(reportData ?? null).includes(ASSET_REF_PREFIX)) return reportData;

  const snap = await getDocs(collection(db, 'monthly_reports', archiveId, ASSET_SUBCOLLECTION));
  const assets = new Map(snap.docs.map(d => [d.id, String(d.data().data || '')]));

  const walk = (value: any): any => {
    if (typeof value === 'string') {
      return value.startsWith(ASSET_REF_PREFIX) ? (assets.get(value.slice(ASSET_REF_PREFIX.length)) || '') : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  return walk(reportData);
}

/** Hapus semua aset gambar milik arsip (dipakai saat arsip dihapus permanen). */
export async function deleteReportAssets(archiveId: string): Promise<void> {
  const assetsCol = collection(db, 'monthly_reports', archiveId, ASSET_SUBCOLLECTION);
  const snap = await getDocs(assetsCol);
  for (let i = 0; i < snap.docs.length; i += BATCH_MAX_OPS) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_MAX_OPS).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
