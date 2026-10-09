// ============================================================================
// FILE: frontend/utils/firestoreRestQuery.ts
// Deskripsi: Query Firestore lewat REST runQuery dengan field mask (projection).
//            SDK web Firestore selalu mengunduh dokumen utuh, jadi koleksi yang
//            dokumennya memuat foto/tanda tangan base64 terasa sangat lambat saat
//            ditampilkan sebagai daftar. Lewat REST hanya field yang diminta yang
//            dikirim. Security rules tetap berlaku karena memakai ID token user.
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import { auth, db } from '@/api/firebase';

interface RestValue {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number | string;
  timestampValue?: string;
  stringValue?: string;
  bytesValue?: string;
  referenceValue?: string;
  geoPointValue?: { latitude: number; longitude: number };
  arrayValue?: { values?: RestValue[] };
  mapValue?: { fields?: Record<string, RestValue> };
}

interface RunQueryRow {
  document?: { name: string; fields?: Record<string, RestValue> };
}

export interface RestQueryOrder {
  field: string;
  direction: 'ASCENDING' | 'DESCENDING';
}

const SIMPLE_FIELD = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Timestamp REST berformat RFC3339 dengan presisi hingga nanodetik.
const decodeTimestamp = (value: string): Timestamp => {
  const match = /^(.*?)(?:\.(\d+))?Z$/.exec(value);
  if (!match) return Timestamp.fromDate(new Date(value));
  const seconds = Math.floor(Date.parse(`${match[1]}Z`) / 1000);
  const nanos = Number((match[2] || '').padEnd(9, '0').slice(0, 9));
  return new Timestamp(seconds, nanos);
};

const decodeValue = (value: RestValue): unknown => {
  if ('nullValue' in value) return null;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.timestampValue !== undefined) return decodeTimestamp(value.timestampValue);
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue !== undefined) return decodeFields(value.mapValue.fields || {});
  if (value.referenceValue !== undefined) return value.referenceValue;
  if (value.geoPointValue !== undefined) return value.geoPointValue;
  if (value.bytesValue !== undefined) return value.bytesValue;
  return undefined;
};

const decodeFields = (fields: Record<string, RestValue>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value);
  }
  return out;
};

/**
 * Ambil seluruh dokumen sebuah koleksi, tapi hanya field yang ada di `fields`.
 * Field yang tidak ada di dokumen cukup tidak dikembalikan.
 */
export async function runProjectedQuery<T extends { id: string }>(
  collectionId: string,
  fields: readonly string[],
  order?: RestQueryOrder
): Promise<T[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User belum login');

  const token = await currentUser.getIdToken();
  const projectId = db.app.options.projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    select: {
      fields: fields.map((f) => ({ fieldPath: SIMPLE_FIELD.test(f) ? f : `\`${f.replace(/`/g, '\\`')}\`` })),
    },
  };
  if (order) {
    structuredQuery.orderBy = [{ field: { fieldPath: order.field }, direction: order.direction }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Firestore runQuery ${res.status}: ${detail.slice(0, 300)}`);
  }

  const rows = (await res.json()) as RunQueryRow[];
  return rows
    .filter((row): row is Required<RunQueryRow> => Boolean(row.document))
    .map((row) => ({
      ...decodeFields(row.document.fields || {}),
      id: row.document.name.split('/').pop() || '',
    }) as unknown as T);
}
