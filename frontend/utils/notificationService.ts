// ============================================================================
// FILE: notificationService.ts
// Deskripsi: Service untuk mengirim notifikasi ke Firestore.
//            Setiap kali ada file/dokumen baru diupload, fungsi ini dipanggil
//            supaya user lain bisa melihat notifikasi di Notification Center.
// Koleksi Firestore: 'notifications'
// ============================================================================

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';

// Interface yang mendefinisikan data notifikasi yang dikirim
export interface NotificationPayload {
  title: string;          // Judul notifikasi (contoh: "Laporan PM Baru")
  fileName: string;       // Nama file yang diupload
  category: string;       // Kategori file (contoh: "Electrical", "Cooling")
  fileId?: string;        // ID file di Firestore (opsional)
  uploadedBy: string;     // Nama user yang mengupload
  targetTab: 'documents' | 'files' | 'corrective_archive' | 'finding_archive' | 'ptw' | 'findings' | 'corrective' | 'pir';  // Tab tujuan saat notifikasi diklik
  searchQuery?: string;   // Query pencarian untuk navigasi otomatis
}

// Fungsi utama untuk mengirim notifikasi ke Firestore
// Dipanggil setelah file berhasil diupload
// Data disimpan ke koleksi 'notifications' dengan timestamp server
export async function sendFileNotification(payload: NotificationPayload) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: payload.title,
      fileName: payload.fileName,
      category: payload.category,
      fileId: payload.fileId || '',
      uploadedBy: payload.uploadedBy || 'User',
      targetTab: payload.targetTab || 'files',
      searchQuery: payload.searchQuery || payload.fileName,
      createdAt: serverTimestamp()  // Timestamp otomatis dari server Firebase
    });
  } catch (err) {
    console.error('Error sending file notification:', err);
  }
}
