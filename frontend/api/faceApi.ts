// ============================================================================
// FILE: frontend/api/faceApi.ts
// Deskripsi: Klien endpoint verifikasi wajah di backend Go (POST /api/face/*).
//            Project Firebase memakai paket Spark (tanpa Cloud Functions), jadi
//            logika wajah ada di backend Go (backend/core/services/face_service.go).
// ============================================================================

import { auth } from '@/api/firebase';
import { getApiEndpoint } from '@/utils/apiConfig';

export class FaceApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FaceApiError';
  }
}

/**
 * Panggil endpoint wajah dengan ID token sesi ini. Pesan error dari server sudah
 * berbahasa Indonesia dan aman ditampilkan ke user.
 */
export async function callFace<T>(path: string, body: unknown = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new FaceApiError('Silakan login dengan email dan password terlebih dahulu.', 401);
  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(getApiEndpoint(`/api/face/${path}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch {
    throw new FaceApiError('Server verifikasi wajah tidak bisa dihubungi. Periksa koneksi internet lalu coba lagi.', 0);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new FaceApiError(payload?.message || `Server verifikasi wajah error (HTTP ${res.status}). Coba lagi.`, res.status);
  }
  return payload as T;
}
