// ============================================================================
// FILE: hseTbmInductionTypes.ts
// Deskripsi: Definisi Tipe Data untuk Modul Absen TBM dan Safety Induction Report (HSE)
// ============================================================================

export interface HSETbmPhoto {
  id?: string;
  base64: string;
  description?: string;
  timestamp?: string;
}

export interface HSETbmRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  totalSDM: number;
  keterangan?: string;
  lokasi?: string;
  inspectorK3?: string;
  authorEmail: string;
  photos: HSETbmPhoto[];
  reportType: 'utt' | 'neutradc';
  hseType: 'tbm';
  createdAt?: any;
  updatedAt?: any;
}

export interface HSESafetyInductionPhotoItem {
  id?: string;
  base64: string;
  label: 'fotoInduction' | 'fotoSuratSehat' | 'fotoSertifikatK3' | string;
  description?: string;
}

export interface HSESafetyInductionParticipant {
  id?: string;
  nama: string;
  perusahaan: string;
  jabatan?: string;
}

export interface HSESafetyInductionRecord {
  id?: string;
  nama: string;
  perusahaan: string;
  pesertaList?: HSESafetyInductionParticipant[];
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  jabatan?: string;
  fotoInduction: string; // Base64 foto orang yang sedang di-induction (Wajib)
  fotoSuratSehat: string; // Base64 foto surat sehat (Wajib)
  fotoSertifikatK3?: string; // Base64 sertifikat K3 dari TDE (Opsional)
  catatan?: string;
  inspectorK3?: string;
  authorEmail: string;
  reportType: 'utt' | 'neutradc';
  hseType: 'induction';
  photos?: HSESafetyInductionPhotoItem[];
  createdAt?: any;
  updatedAt?: any;
}
