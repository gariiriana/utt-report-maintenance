// ============================================================================
// FILE: frontend/types/faceAuthTypes.ts
// Deskripsi: Definisi tipe data untuk fitur Autentikasi Biometrik Wajah (Face ID)
//            dan Manajemen Registrasi Wajah oleh QC DME (qc@gmail.com).
// ============================================================================

export interface RegisteredFace {
  id: string;
  name: string;               // Nama lengkap identitas personel (e.g. "Gari Iriana")
  accountEmail: string;       // Akun email login yang dituju (e.g. "pump@gmail.com")
  accountPassword?: string;   // Kata sandi akun (opsional, untuk login otomatis Firebase)
  role: string;               // Role akun (e.g. "engineer", "qc_dme", "admin")
  photoBase64: string;        // Foto wajah avatar yang di-crop
  faceDescriptor: number[];   // Vektor fitur numerik biometrik wajah
  registeredBy: string;       // Email pembuat (qc@gmail.com)
  registeredAt: string;       // Waktu registrasi ISO string
  status: 'active' | 'inactive';
  notes?: string;
  department?: string;        // Divisi / Unit (e.g. "Mechanical & Electrical")
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
