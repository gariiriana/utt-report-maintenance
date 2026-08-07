// ============================================================================
// FILE: frontend/types/pirReportTypes.ts
// Deskripsi: Definisi Tipe TypeScript & Initial Template Nilai Bawaan untuk Laporan PIR
//            (Post Incident Report / Root Cause Analysis) Data Center NeutraDC.
//            Struktur dokumen 9-Halaman resmi yang mencakup kronologi insiden,
//            analisis akar masalah, tingkat keparahan (Severity), rencana perbaikan,
//            serta matrik tanda tangan penanggung jawab TDE & DME.
// ============================================================================

/** Tipe Data Rencana Tindakan Perbaikan (Corrective Action Item) PIR */
export interface PIRCorrectiveAction {
    actionItem: string;                     // Rincian tindakan perbaikan (misal "Pembersihan filter CRAC 03")
    typeOfAction: string;                   // Jenis tindakan (Preventive / Corrective / Upgrade)
    assignedTo: string;                     // Penanggung jawab eksekusi (misal "Teknisi HVAC UTT")
    bug: string;                            // ID / Catatan Tiket pelacakan
    startDate: string;                      // Tanggal mulai
    endDate: string;                        // Target tanggal selesai
}

/** Foto Dokumentasi Lampiran PIR */
export interface PIRPhoto {
    photoBase64: string;                    // Gambar base64
    caption: string;                        // Keterangan foto insiden
}

/** Struktur Utama Data Laporan PIR (Post Incident Report) */
export interface PIRReportData {
    id?: string;                            // ID unik dokumen di Firestore
    reportType?: 'PIR';                     // Penanda tipe laporan PIR
    reportedAt?: any;                       // Timestamp pengiriman
    reportedBy?: string;                    // Nama user pengirim
    reportedByEmail?: string;               // Email user pengirim

    // Halaman 1: Header Dokumen & Informasi Utama Insiden
    incidentName: string;                   // Nama Insiden
    incidentDate: string;                   // Tanggal Kejadian (ISO String)
    incidentId: string;                     // Nomor ID Insiden Tiket
    postmortemOwner: string;                // Penanggung Jawab Postmortem (Lead Engineer)
    dateCompleted: string;                  // Tanggal Laporan Dibatalkan/Diselesaikan
    reportAuthors: string;                  // Penulis Dokumen Laporan PIR
    reportId: string;                       // Kode Nomor Dokumen PIR
    linkToIncidentRecording: string;        // Link video/rekaman CCTV insiden (jika ada)
    postmortemMeetingDate: string;          // Tanggal Rapat Evaluasi Postmortem

    // Daftar Peserta Hadir Rapat Evaluasi Insiden
    attendeesTDE: string[];                 // Tim Peserta dari TDE (Telkom Data Ekosistem)
    attendeesDME: string[];                 // Tim Peserta dari PT Dwimitra Ekatama Mandiri (DME)

    // Tingkat Keparahan Dampak Insiden (Severity)
    severityLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'OTHER'; // Level keparahan
    severityComments: string;               // Catatan penilaian keparahan

    // Halaman 2: Ringkasan Eksekutif Insiden (Executive Summary)
    summary: string;                        // Ringkasan singkat penyebab & dampak kejadian

    // Halaman 3: Rincian Gambaran Umum Insiden (Incident Overview)
    impact: string;                         // Dampak operasional ke layanan Data Center
    trigger: string;                        // Pemicu awal terjadinya gangguan
    rootCause: string;                      // Akar penyebab utama (Root Cause Analysis)
    detection: string;                      // Bagaimana gangguan terdeteksi (Alarm/Manual Check)
    response: string;                       // Respon awal tim teknisi di lokasi
    resolution: string;                     // Cara penyelesaian akhir gangguan

    // Halaman 4: Faktor Pendukung & Pembelajaran K3 (Lessons Learned)
    contributingFactors: string;           // Faktor-faktor pendukung terjadinya insiden
    whatWentWell: string;                  // Hal yang sudah berjalan baik saat penanganan
    whatWentPoorly: string;                // Hal yang kurang baik / perlu diperbaiki
    whereWereWeLucky: string;              // Hal yang menguntungkan/mencegah dampak lebih buruk

    // Halaman 5 & 6: Tabel Daftar Rencana Perbaikan (Corrective Actions)
    correctiveActions: PIRCorrectiveAction[];

    // Halaman 7 & 8: Lampiran Foto Dokumentasi In-situ
    photos: PIRPhoto[];

    // Halaman 9: Matriks Otorisasi & Tanda Tangan Resmi
    preparedByName: string;                 // Pembuat Laporan (Shift Engineer)
    preparedByTitle: string;                // Jabatan Pembuat

    reviewedBy1Name: string;                // Pemeriksa 1 (Technical Manager)
    reviewedBy1Title: string;               // Jabatan Pemeriksa 1
    reviewedBy2Name: string;                // Pemeriksa 2 (Project Manager)
    reviewedBy2Title: string;               // Jabatan Pemeriksa 2

    acknowledgedBy1Name: string;            // Mengetahui 1 (Chief Engineer)
    acknowledgedBy1Title: string;           // Jabatan Mengetahui 1
    acknowledgedBy2Name: string;            // Mengetahui 2 (Facility Manager)
    acknowledgedBy2Title: string;           // Jabatan Mengetahui 2

    approvedBy1Name: string;                // Penyetuju 1 (Assistant Manager HDC)
    approvedBy1Title: string;               // Jabatan Penyetuju 1
    approvedBy2Name: string;                // Penyetuju 2 (Manager HDC Operation)
    approvedBy2Title: string;               // Jabatan Penyetuju 2

    approvedBy3Name: string;                // Penyetuju 3 (EGM DC Operation)
    approvedBy3Title: string;               // Jabatan Penyetuju 3
}

// Data Awal Bawaan Format Baku PIR Laporan UTT / NeutraDC
export const INITIAL_PIR_REPORT_DATA: PIRReportData = {
    reportType: 'PIR',
    incidentName: '',
    incidentDate: '',
    incidentId: '',
    postmortemOwner: '',
    dateCompleted: '',
    reportAuthors: '',
    reportId: '',
    linkToIncidentRecording: '',
    postmortemMeetingDate: '',

    attendeesTDE: [],
    attendeesDME: [],

    severityLevel: 'LOW',
    severityComments: '',

    summary: '',
    impact: '',
    trigger: '',
    rootCause: '',
    detection: '',
    response: '',
    resolution: '',

    contributingFactors: '',
    whatWentWell: '',
    whatWentPoorly: '',
    whereWereWeLucky: '',

    correctiveActions: [],
    photos: [],

    // Matriks Otorisasi Nama & Jabatan Baku
    preparedByName: 'Agil Zakia Rahman',
    preparedByTitle: '(Shift Engineer)',

    reviewedBy1Name: 'Arif Budiman',
    reviewedBy1Title: '(Technical Manager)',
    reviewedBy2Name: 'Dwi Tasmiyadi',
    reviewedBy2Title: '(Project manager)',

    acknowledgedBy1Name: 'Andrean Bima Pratama',
    acknowledgedBy1Title: '(Chief Engineer)',
    acknowledgedBy2Name: 'Supriyatno',
    acknowledgedBy2Title: '(Facility manager)',

    approvedBy1Name: 'Budi Susanto',
    approvedBy1Title: '(Assistant manager HDC Facility Management)',
    approvedBy2Name: 'Rezki Rahman Daulay',
    approvedBy2Title: '(Manager HDC Operation)',

    approvedBy3Name: 'Muryani',
    approvedBy3Title: '(EGM DC Operation)'
};
