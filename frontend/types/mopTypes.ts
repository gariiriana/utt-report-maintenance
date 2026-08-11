// ============================================================================
// FILE: frontend/types/mopTypes.ts
// Deskripsi: TypeScript type definitions untuk MOP (Method of Procedure)
//            Workflow Management System — fitur Site Manager DME.
// ============================================================================

import { Timestamp } from 'firebase/firestore';

/**
 * Status MOP Workflow
 * - draft: MOP baru dibuat, belum diajukan
 * - review_ocs: Sedang menunggu review OCS (Operational)
 * - revision_ocs: OCS meminta revisi
 * - approved_ocs: OCS sudah approve, menunggu upload file approved
 * - review_tde: Sedang menunggu review TDE (User)
 * - revision_tde: TDE meminta revisi
 * - completed: TDE sudah approve, MOP final
 */
export type MOPStatus =
  | 'draft'
  | 'review_ocs'
  | 'revision_ocs'
  | 'approved_ocs'
  | 'review_tde'
  | 'revision_tde'
  | 'completed';

/**
 * Remark/komentar pada MOP workflow
 */
export interface MOPRemark {
  author: string;        // Email user
  authorName: string;    // Display name
  message: string;       // Isi remark
  timestamp: Timestamp;  // Waktu remark
  phase: 'ocs' | 'tde';  // Fase remark: saat review OCS atau TDE
}

/**
 * File attachment pada MOP (metadata, data disimpan di subcollection chunks)
 */
export interface MOPFileAttachment {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedAt: Timestamp;
  fileType: 'draft' | 'ocs_approved' | 'tde_approved' | 'revision';
}

/**
 * Dokumen utama MOP Workflow di Firestore
 * Collection: mop_workflows
 */
export interface MOPWorkflowDoc {
  id: string;
  mopNumber: string;       // e.g. "MOP-2026-001"
  title: string;           // e.g. "PM ATS Quarter 3"
  equipmentType: string;   // e.g. "ATS", "CT", "PDU"
  quarter: string;         // e.g. "Q3-2026"
  description?: string;    // Deskripsi tambahan

  // Status tracking
  status: MOPStatus;

  // File metadata (data chunks di subcollection)
  draftFile?: MOPFileAttachment;
  ocsApprovedFile?: MOPFileAttachment;
  tdeApprovedFile?: MOPFileAttachment;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedToOcsAt?: Timestamp;
  ocsResponseAt?: Timestamp;
  submittedToTdeAt?: Timestamp;
  tdeResponseAt?: Timestamp;
  completedAt?: Timestamp;

  // Remarks / revision history
  remarks: MOPRemark[];

  // User info
  createdBy: string;       // UID
  createdByEmail: string;  // Email
  createdByName: string;   // Display name
}

/**
 * Form data untuk membuat MOP baru
 */
export interface MOPCreateFormData {
  title: string;
  equipmentType: string;
  quarter: string;
  description: string;
}

/**
 * Statistik MOP untuk monitoring dashboard
 */
export interface MOPStats {
  total: number;
  draft: number;
  reviewOcs: number;
  revisionOcs: number;
  approvedOcs: number;
  reviewTde: number;
  revisionTde: number;
  completed: number;
}

/**
 * Daftar equipment types yang tersedia
 */
export const EQUIPMENT_TYPES = [
  'ATS', 'FCU', 'CT', 'PDU', 'PJU', 'Generator', 'AC Split',
  'Trafo', 'Pump', 'MV', 'LPS', 'Grounding', 'LDB/RDB',
  'Busduct', 'Lighting System', 'CRAC', 'WLD', 'FLD',
  'Rolling Door', 'Exhaust Fan', 'LV Panel', 'VRV', 'AHHU', 'Lainnya'
] as const;

/**
 * Mapping status ke label Indonesia
 */
export const MOP_STATUS_LABELS: Record<MOPStatus, string> = {
  draft: 'Draft',
  review_ocs: 'Review OCS',
  revision_ocs: 'Revisi OCS',
  approved_ocs: 'Approved OCS',
  review_tde: 'Review TDE',
  revision_tde: 'Revisi TDE',
  completed: 'Selesai',
};

/**
 * Mapping status ke warna badge
 */
export const MOP_STATUS_COLORS: Record<MOPStatus, { bg: string; text: string; border: string; dot: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  review_ocs: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  revision_ocs: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-400' },
  approved_ocs: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  review_tde: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  revision_tde: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
};

/**
 * Quarters yang tersedia (auto-generate dari tahun berjalan)
 */
export const generateQuarters = (): string[] => {
  const year = new Date().getFullYear();
  return [
    `Q1-${year}`, `Q2-${year}`, `Q3-${year}`, `Q4-${year}`,
    `Q1-${year + 1}`, `Q2-${year + 1}`,
  ];
};

/**
 * Generate MOP number dari counter
 */
export const generateMOPNumber = (counter: number): string => {
  const year = new Date().getFullYear();
  return `MOP-${year}-${String(counter).padStart(3, '0')}`;
};

/**
 * Chunk size untuk file upload ke Firestore (~750KB per chunk)
 */
export const MOP_CHUNK_SIZE = 750 * 1024;

/**
 * Maksimal ukuran file MOP (15MB)
 */
export const MOP_MAX_FILE_SIZE = 15 * 1024 * 1024;
