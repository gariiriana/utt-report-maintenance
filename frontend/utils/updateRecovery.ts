export type RecoveryRecord<T> = { version: 1; savedAt: number; value: T };
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function recoveryKey(tabId: string, userId: string, pathname: string, form: string) {
  return ['app-update-v1', tabId, userId, pathname, form].map(encodeURIComponent).join(':');
}

export function validRecovery<T>(record: RecoveryRecord<T> | undefined | null): record is RecoveryRecord<T> {
  return record?.version === 1 && Number.isFinite(record.savedAt)
    && Date.now() - record.savedAt >= 0 && Date.now() - record.savedAt < MAX_AGE_MS;
}

export function mergeRecovery<T>(defaults: T, saved: T): T {
  const plain = (value: unknown): value is Record<string, unknown> => !!value
    && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
  if (!plain(defaults) || !plain(saved)) return saved;
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(saved)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    merged[key] = key in defaults ? mergeRecovery(defaults[key], saved[key]) : saved[key];
  }
  return merged as T;
}


// Object URLs expire on reload. Persist their contents, not the temporary URL.
export async function preserveDraftAssets<T>(value: T): Promise<T> {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    const response = await fetch(value);
    if (!response.ok) throw new Error('Lampiran belum berhasil disimpan.');
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }) as T;
  }
  if (Array.isArray(value)) return await Promise.all(value.map(preserveDraftAssets)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await preserveDraftAssets(item)]));
    return Object.fromEntries(entries) as T;
  }
  // IndexedDB preserves File, Blob, ArrayBuffer, Date, Map and Set directly.
  return value;
}
