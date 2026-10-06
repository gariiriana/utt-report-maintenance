// ============================================================================
// FILE: frontend/types/faceAuthTypes.ts
// Deskripsi: Tipe data respons Cloud Functions verifikasi wajah (face-auth.ts).
// ============================================================================

// Akun yang tidak wajib scan wajah (keputusan Gari, 6 Okt 2026). Samakan dengan
// FACE_EXEMPT_EMAILS di functions/src/face-auth.ts, firebase/firestore.rules dan
// backend/core/middlewares/auth.go.
export const FACE_EXEMPT_EMAILS = ['qcdme@dme.com'];

export type FaceProfileStatus = 'pending' | 'approved' | 'rejected';

export interface FaceEnrollmentState {
  id: string;
  name: string;
  company: string;
  status: FaceProfileStatus;
  rejectReason: string;
}

export interface FaceGateState {
  enrollments: FaceEnrollmentState[];
}

// Sengaja tidak memuat nama profil lain: pendaftar tidak boleh melihat data orang lain.
export interface FaceEnrollResult {
  alreadyRegistered: boolean;
  id?: string;
}

export interface FaceVerifyResult {
  matched: boolean;
  token?: string;
  person?: string;
  faceUntil?: number;
}

export interface FaceAdminProfile {
  id: string;
  accountEmail: string; // akun tempat pengajuan dibuat (wajah berlaku di semua akun)
  name: string;
  company: string; // kosong untuk pengajuan lama (sebelum kolom perusahaan wajib)
  status: FaceProfileStatus;
  photos: string[];
  device: string;
  requestedAt: number | null;
  reviewedBy: string;
  reviewedAt: number | null;
  rejectReason: string;
  possibleDuplicateOf: string; // nama wajah lain (aktif/menunggu) yang mirip (peringatan untuk QC)
  possibleDuplicateId: string; // ID wajah mirip itu (tujuan "Gabungkan" bila sudah aktif)
}

export interface FaceAuditEntry {
  id: string;
  type: string;
  accountEmail: string;
  person: string;
  nearestPerson: string; // login gagal: wajah terdaftar yang paling mirip
  distance: number | null; // jarak wajah (makin kecil makin mirip; lolos jika < 0.42)
  device: string; // misal "Chrome 129 di Android 14"
  issue: string; // scan_issue: jenis kendala teknis
  detail: string; // scan_issue: detail teknis (untuk diagnosa)
  by: string;
  ip: string;
  at: number | null;
}
