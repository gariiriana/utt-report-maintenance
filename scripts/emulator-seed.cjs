// ============================================================================
// FILE: scripts/emulator-seed.cjs
// Deskripsi: Membuat akun & profil tes di Firebase Emulator untuk mencoba
//            fitur scan wajah secara lokal. Menolak jalan jika tidak diarahkan
//            ke emulator, supaya tidak pernah menyentuh project production.
// Pakai:     npm run emulators   (terminal 1)
//            npm run emulators:seed   (terminal 2)
// ============================================================================

const isLocal = (v) => typeof v === 'string' && /^(127\.0\.0\.1|localhost):\d+$/.test(v);

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';

if (!isLocal(process.env.FIREBASE_AUTH_EMULATOR_HOST) || !isLocal(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Batal: FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST harus mengarah ke emulator lokal.');
  process.exit(1);
}

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'report-utt' });

const PASSWORD = 'tes12345';
const USERS = [
  { email: 'qcdme@dme.com', role: 'qc_dme' },
  { email: 'ats@gmail.com', role: 'engineer' },
  { email: 'admin@test.local', role: 'admin' }
];

(async () => {
  for (const u of USERS) {
    let record;
    try {
      record = await admin.auth().getUserByEmail(u.email);
    } catch {
      record = await admin.auth().createUser({ email: u.email, password: PASSWORD, emailVerified: true });
    }
    await admin.firestore().doc(`users/${record.uid}`).set({
      email: u.email, uid: record.uid, role: u.role, companyType: 'neutra',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✓ ${u.email} (${u.role}) — password: ${PASSWORD}`);
  }
  console.log('\nKode akses darurat (emulator): lokal-darurat-12345');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
