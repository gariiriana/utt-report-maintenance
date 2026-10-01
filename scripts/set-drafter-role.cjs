// Usage: node scripts/set-drafter-role.cjs --apply
// Uses local credentials without printing key material. Only this explicitly requested account is changed.
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const email = 'muhammadrifaldi711@gmail.com';
async function applyUsingCLI() {
  // Read the existing Firebase CLI login; tokens stay in memory and are never logged.
  const cliAuth = require('D:/npm/node_modules/firebase-tools/lib/auth.js');
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI login is unavailable.');
  const tokens = await cliAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes);
  const call = async (url, method, body) => {
    const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const value = await response.json();
    if (!response.ok) throw new Error('Firebase ' + response.status + ': ' + (value.error?.message || 'request failed'));
    return value;
  };
  const authURL = 'https://identitytoolkit.googleapis.com/v1/projects/report-utt/accounts:';
  const result = await call(authURL + 'lookup', 'POST', { email: [email] });
  const user = result.users?.find(user => user.email?.toLowerCase() === email);
  if (!user?.localId) throw new Error('Exact account was not found. No changes made.');
  const receipt = { email, uid: user.localId, project: 'report-utt', role: 'drafter', profileWriteConfirmed: false, claimsConfirmed: false };
  try {
    await call('https://firestore.googleapis.com/v1/projects/report-utt/databases/(default)/documents/users/' + encodeURIComponent(user.localId) + '?updateMask.fieldPaths=role', 'PATCH', { fields: { role: { stringValue: 'drafter' } } });
    receipt.profileWriteConfirmed = true;
    const claims = JSON.parse(user.customAttributes || '{}');
    await call(authURL + 'update', 'POST', { localId: user.localId, customAttributes: JSON.stringify({ ...claims, role: 'drafter' }) });
    const verified = await call(authURL + 'lookup', 'POST', { localId: [user.localId] });
    receipt.claimsConfirmed = JSON.parse(verified.users?.[0]?.customAttributes || '{}').role === 'drafter';
    if (!receipt.claimsConfirmed) throw new Error('Role claim verification failed.');
    console.log(JSON.stringify(receipt));
  } catch (error) { console.log(JSON.stringify(receipt)); throw error; }
}

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Use --apply to perform the explicitly requested account role change.');
  if (process.argv.includes('--cli')) return applyUsingCLI();
  const candidates = ['firebase-service-account.json', 'firebase/firebase-service-account.json', 'backend/firebase-service-account.json'];
  const credentialPath = candidates.map(file => path.resolve(__dirname, '..', file)).find(file => fs.existsSync(file));
  if (!credentialPath) throw new Error('No local Firebase Admin credential found.');
  const credential = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  if (credential.project_id !== 'report-utt') throw new Error('Credential project does not match report-utt. No changes made.');
  const app = initializeApp({ credential: cert(credential), projectId: 'report-utt' }, 'drafter-role-assignment');
  const receipt = { email, project: 'report-utt', role: 'drafter', profileWriteConfirmed: false, claimsConfirmed: false };
  try {
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(email);
    receipt.uid = user.uid;
    // Merge never resets existing profile data and does not need a quota-consuming profile query.
    await getFirestore(app).doc('users/' + user.uid).set({ role: 'drafter' }, { merge: true });
    receipt.profileWriteConfirmed = true;
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'drafter' });
    const updated = await auth.getUser(user.uid);
    receipt.claimsConfirmed = updated.customClaims?.role === 'drafter';
    if (!receipt.claimsConfirmed) throw new Error('Role claim verification failed.');
    console.log(JSON.stringify(receipt));
  } catch (error) {
    console.log(JSON.stringify(receipt));
    throw error;
  } finally { await deleteApp(app); }
}
main().catch(error => { console.error(error.code || 'role-update-failed', error.message); process.exitCode = 1; });
