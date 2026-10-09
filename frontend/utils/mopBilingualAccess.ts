// ============================================================================
// FILE: frontend/utils/mopBilingualAccess.ts
// Deskripsi: Akun yang boleh memakai menu Bilingual MOP & Arsip MOP.
//            Daftar ini harus sama dengan canUseMOPBilingual di
//            backend/core/controllers/mop_controller.go dan canManageMOPBilingual
//            di firebase/firestore.rules.
// ============================================================================

const MOP_BILINGUAL_EMAILS = ['dwimitra@co.id', 'qcdme@dme.com', 'johansmdme@dwimitra.id'];

export const canUseMOPBilingual = (email?: string | null, isQcDme = false): boolean =>
  isQcDme || MOP_BILINGUAL_EMAILS.includes((email || '').trim().toLowerCase());
