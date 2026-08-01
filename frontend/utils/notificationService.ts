import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';

export interface NotificationPayload {
  title: string;
  fileName: string;
  category: string;
  fileId?: string;
  uploadedBy: string;
  targetTab: 'documents' | 'files' | 'corrective_archive' | 'finding_archive' | 'ptw' | 'findings' | 'corrective';
  searchQuery?: string;
}

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
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Error sending file notification:', err);
  }
}
