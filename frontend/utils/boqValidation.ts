import type { BOQFields, NewBOQItemInput } from '@/types/boq';
export class BOQConflictError extends Error {
  constructor() { super('Item telah diubah pengguna lain. Muat versi terbaru sebelum menyimpan.'); }
}
export function validateBOQFields(fields: BOQFields): BOQFields {
  const result = {
    ciName: fields.ciName.trim(),
    ciDescription: fields.ciDescription.trim(),
    capacity: fields.capacity.trim(),
    serialNumber: fields.serialNumber?.trim() || '',
    productionYear: fields.productionYear?.trim() || '',
    manufacturer: fields.manufacturer?.trim() || '',
  };
  if (!result.ciName || result.ciName.length > 500 || result.ciDescription.length > 2000 || result.capacity.length > 500 ||
      result.serialNumber.length > 500 || result.productionYear.length > 20 || result.manufacturer.length > 500) {
    throw new Error('CI Name wajib diisi (maks. 500 karakter); deskripsi maks. 2.000; kapasitas, serial number, dan manufacturer maks. 500; tahun produksi maks. 20.');
  }
  return result;
}
export function validateNewBOQItem(input: NewBOQItemInput): NewBOQItemInput {
  const result = {
    ...validateBOQFields(input),
    room: input.room.trim(),
    classId: input.classId.trim(),
    floor: input.floor.trim(),
  };
  if (!result.room || !result.classId) throw new Error('Ruangan dan Class Id wajib diisi.');
  if (result.room.length > 200 || result.classId.length > 200 || result.floor.length > 50) {
    throw new Error('Ruangan dan Class Id maks. 200 karakter; lantai maks. 50.');
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
