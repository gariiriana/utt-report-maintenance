// ============================================================================
// FILE: frontend/types/correctiveReportTypes.ts
// Deskripsi: Definisi Struktur Data TypeScript Laporan Corrective Maintenance (CM Report 3-Halaman Standar UTT).
//            Merupakan acuan tipe data untuk pengisian form wizard CMReportFormModal.tsx
//            dan pencetakan dokumen resmi DOCX & PDF (docxReportExport.ts & CMReportPdfExport.ts).
// ============================================================================

/** Items suku cadang/sparepart terpakai dalam perbaikan CM */
export interface CMSparepartItem {
  no?: number;                              // Nomor urut item
  name: string;                             // Nama komponen/sparepart (misal "Relay 24VDC")
  brand: string;                            // Merk/Manufaktur (misal "Omron")
  qty: string;                              // Kuantitas terpakai (misal "2 Pcs")
}

/** Foto dokumentasi bukti perbaikan CM (Sebelum, Proses, & Sesudah) */
export interface CMPhotoItem {
  photoBase64: string;                      // Gambar base64
  description?: string;                     // Keterangan foto (misal "Penggantian modul kipas")
}

/** Struktur Data Utama Laporan Corrective Maintenance (CM Report) */
export interface CMReportData {
  id?: string;                              // ID unik dokumen di Firestore
  reportType?: 'CM_STANDARD' | 'SLA' | 'CM_PDF'; // Tipe laporan
  
  // Klasifikasi Troubleshoot (Apakah Pergantian Sparepart atau Bukan)
  troubleshootType?: 'non_sparepart' | 'sparepart_replacement'; // 'non_sparepart' = Wajib SLA, 'sparepart_replacement' = Tanpa SLA
  isSparepartReplacement?: boolean;                             // Flag pembantu cepat

  // Halaman 1: Informasi Insiden & Spesifikasi Perangkat
  incidentName: string;                     // Nama Insiden/Gangguan (misal "Alarm High Temp CRAC 03")
  location: string;                         // Lokasi Ruangan (misal "CRAC Room 3 - Campus 5")
  incidentDate: string;                     // Tanggal & Jam Kejadian (ISO String)
  incidentId: string;                       // Nomor Tiket / ID Gangguan
  
  equipmentName: string;                    // Nama Perangkat (misal "CRAC Unit 3")
  brand: string;                            // Merk Perangkat (misal "Liebert Emerson")
  serialNumber: string;                     // Nomor Seri (S/N)
  installationDate: string;                 // Tanggal Operasional/Instalasi Perangkat
  
  // Halaman 1: Tindakan Perbaikan & Hasil Inspeksi
  correctiveAction: string;                 // Deskripsi tindakan perbaikan cepat
  repairTimeStart: string;                  // Jam Mulai Pengerjaan (misal "09:15 WIB")
  repairTimeEnd: string;                    // Jam Selesai Pengerjaan (misal "11:30 WIB")
  result: string;                           // Hasil Akhir (misal "Normal Operational")
  
  visualInspectionChecking: string;         // Catatan Hasil Pemeriksaan Fisik & Visual
  cleaningPreventiveMethod: string;         // Tindakan Pembersihan & Pemeliharaan Pencegahan
  summaryProblemAnalysis: string;           // Rincian Analisis Akar Masalah (Root Cause Analysis)
  
  // Halaman 2: Pengadaan Suku Cadang & Foto Dokumentasi
  spareparts: CMSparepartItem[];            // Array rincian suku cadang terpakai
  photos: CMPhotoItem[];                    // Array foto dokumentasi perbaikan
  
  // Halaman 3: Otorisasi & Tanda Tangan Digital Insinyur / Manajemen
  authorName: string;                       // Nama Penulis Laporan
  preparedByName: string;                   // Pembuat Laporan (Standby Engineer)
  preparedByTitle: string;                  // Jabatan Pembuat
  preparedBySign?: string;                  // Tanda Tangan Base64 Pembuat
  reviewedByName: string;                   // Pemeriksa Laporan (Site Manager / Lead)
  reviewedByTitle: string;                  // Jabatan Pemeriksa
  reviewedBySign?: string;                  // Tanda Tangan Base64 Pemeriksa
  acknowledgedBy1Name: string;              // Mengetahui 1 (Manager/Director DEM)
  acknowledgedBy1Title: string;             // Jabatan Mengetahui 1
  acknowledgedBy1Sign?: string;             // Tanda Tangan Base64 Mengetahui 1
  acknowledgedBy2Name: string;              // Mengetahui 2 (Klien NeutraDC)
  acknowledgedBy2Title: string;             // Jabatan Mengetahui 2
  acknowledgedBy2Sign?: string;             // Tanda Tangan Base64 Mengetahui 2
  approvedByName: string;                   // Penyertuju Laporan
  approvedByTitle: string;                  // Jabatan Penyetuju
  approvedBySign?: string;                  // Tanda Tangan Base64 Penyetuju
  
  // Metadata Sistem Firestore
  reportedBy?: string;                      // Nama User Pengirim
  reportedByEmail?: string;                 // Email User Pengirim
  reportedAt?: any;                         // Timestamp Pengiriman
  createdAt?: any;                          // Timestamp Pembuatan
}
