import type { BOQEditableField, BOQFields, NewBOQItemInput } from '@/types/boq';
export const BOQ_EDITABLE_FIELDS: BOQEditableField[] = ['ciName', 'ciDescription', 'capacity', 'serialNumber', 'productionYear', 'manufacturer', 'assetId', 'tag', 'model'];
export class BOQConflictError extends Error {
  constructor() { super('Item telah diubah pengguna lain. Muat versi terbaru sebelum menyimpan.'); }
}
export function validateBOQFields(fields: BOQFields): BOQFields {
  const result = Object.fromEntries(BOQ_EDITABLE_FIELDS.map(field => [field, fields[field]?.trim() || ''])) as BOQFields;
  const limit = (field: keyof BOQFields) => field === 'ciDescription' ? 2000 : field === 'productionYear' ? 20 : 500;
  if (!result.ciName || BOQ_EDITABLE_FIELDS.some(field => result[field].length > limit(field))) {
    throw new Error('CI Name wajib diisi (maks. 500 karakter); deskripsi maks. 2.000; tahun produksi maks. 20; kolom lain maks. 500.');
  }
  return result;
}
export function validateNewBOQItem(input: NewBOQItemInput): NewBOQItemInput {
  const result = {
    ...validateBOQFields(input),
    room: input.room.trim(),
    classId: input.classId.trim(),
    floor: input.floor.trim(),
    category: input.category.trim(),
  };
  if (!result.room || !result.classId) throw new Error('Ruangan dan Class Id wajib diisi.');
  if (result.room.length > 200 || result.classId.length > 200 || result.floor.length > 50 || result.category.length > 100) {
    throw new Error('Ruangan dan Class Id maks. 200 karakter; kategori maks. 100; lantai maks. 50.');
  }
  return result;
}
export function assertBOQRevision(current: number, expected: number) {
  if (current !== expected) throw new BOQConflictError();
}
export function boqErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  if (code.includes('resource-exhausted')) return 'Firestore membatasi request (kuota atau rate limit, HTTP 429). Server belum mengonfirmasi perubahan; draf tetap tersimpan di browser. Coba lagi setelah batas pulih.';
  if (code.includes('permission-denied') || code.includes('unauthorized')) return 'Akses ditolak. Pastikan role dan aturan BOQ sudah aktif, lalu login ulang.';
  if (code.includes('unavailable') || code.includes('retry-limit-exceeded')) return 'Koneksi terputus. Perubahan belum tersimpan; periksa jaringan lalu coba lagi.';
  return error instanceof Error ? error.message : 'Gagal menyimpan. Coba lagi.';
}
