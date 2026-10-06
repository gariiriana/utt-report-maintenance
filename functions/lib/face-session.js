"use strict";
// ============================================================================
// FILE: functions/src/face-session.ts
// Deskripsi: Guard sesi scan wajah (2FA) untuk callable lama (AI, WhatsApp), bila
//            suatu saat Cloud Functions di-deploy (butuh paket Blaze; project saat
//            ini Spark). Verifikasi wajahnya sendiri ada di backend Go
//            (backend/core/services/face_service.go). Logika sama dengan
//            hasFaceSession di firebase/firestore.rules. Lihat scanning.md.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFaceSession = requireFaceSession;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// Samakan dengan FaceExemptEmails di backend/core/middlewares/auth.go.
const FACE_EXEMPT_EMAILS = ['qcdme@dme.com'];
/** Wajib login DAN sesi wajah yang sah (profil wajahnya masih disetujui QC). */
async function requireFaceSession(request) {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Silakan login dengan email dan password terlebih dahulu.');
    }
    const token = request.auth.token;
    const email = String(token.email || '').toLowerCase();
    let active = FACE_EXEMPT_EMAILS.includes(email);
    if (!active && Number(token.faceUntil || 0) * 1000 > Date.now()) {
        const faceId = String(token.faceId || '');
        if (faceId === 'break-glass') {
            active = true;
        }
        else if (faceId) {
            const snap = await admin.firestore().doc(`face_profiles/${faceId}`).get();
            active = snap.exists && snap.data()?.status === 'approved';
        }
    }
    if (!active) {
        throw new https_1.HttpsError('permission-denied', 'Verifikasi wajah diperlukan. Silakan scan wajah ulang.');
    }
    return { uid: request.auth.uid, email, token: request.auth.token };
}
//# sourceMappingURL=face-session.js.map