// ============================================================================
// FILE: frontend/types/faceAuthTypes.ts
// Deskripsi: Definisi tipe data untuk fitur Autentikasi Biometrik Wajah (Face ID)
//            dan Manajemen Registrasi Wajah oleh QC DME (qc@gmail.com).
// ============================================================================

export interface RegisteredFace {
  id: string;
  name: string;               // Nama lengkap identitas personel (e.g. "Riyan Bayu Nugroho")
  photoBase64: string;        // Foto wajah avatar yang di-crop
  faceDescriptor: number[];   // Vektor fitur numerik biometrik wajah
  registeredBy: string;       // Email pembuat (qc@gmail.com)
  registeredAt: string;       // Waktu registrasi ISO string
  status: 'active' | 'inactive';
  accountEmail?: string;      // Opsional
  accountPassword?: string;   // Opsional
  role?: string;              // Opsional
  notes?: string;
  department?: string;        // Opsional
}

export interface FaceMatchResult {
  isMatch: boolean;
  confidence: number;         // Persentase kemiripan 0 - 100%
  matchedPerson?: RegisteredFace;
  distance: number;           // Jarak Euclidean atau selisih fitur (makin kecil makin mirip)
  message?: string;
}

export interface DetectedFaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}
