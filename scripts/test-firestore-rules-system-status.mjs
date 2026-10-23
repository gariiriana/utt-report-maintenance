// Firestore rules check for system_status — emulator only (demo- project, no production access).
// Run: firebase emulators:exec --only firestore --project demo-dwimitra "node scripts/test-firestore-rules-system-status.mjs"
const PROJECT = 'demo-dwimitra';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const label = process.argv[2] || 'new';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function idToken(uid, email) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT,
    iat: now, exp: now + 3600, auth_time: now, sub: uid, user_id: uid,
    email, email_verified: false, firebase: { sign_in_provider: 'password', identities: {} },
  })}.`;
}

async function call(method, path, auth, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(`${BASE}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.status;
}

const doc = (fields) => ({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: String(v) }])) });

// Seed with the emulator's admin bypass token.
await call('PATCH', 'system_status/ai_limit_tracker', 'owner', doc({ date: '2026-10-23' }));
await call('PATCH', 'system_status/wa_reminder_config', 'owner', doc({ fonnte_token: 'dummy' }));
await call('PATCH', 'system_status/wa_reminder_config/logs/l1', 'owner', doc({ msg: 'x' }));
await call('PATCH', 'users/random', 'owner', doc({ role: 'engineer', email: 'random.user@gmail.com' }));

const attacker = idToken('attacker', 'dwimitra.attacker@gmail.com');
const random = idToken('random', 'random.user@gmail.com');
const dwi = idToken('dwi', 'dwimitra@co.id');

const cases = [
  ['self-registered *dwimitra* email writes ai_limit_tracker', 'PATCH', 'system_status/ai_limit_tracker', attacker, doc({ date: 'tampered' }), 403],
  ['dwimitra@co.id writes ai_limit_tracker', 'PATCH', 'system_status/ai_limit_tracker', dwi, doc({ date: '2026-10-23' }), 200],
  ['signed-in user reads ai_limit_tracker', 'GET', 'system_status/ai_limit_tracker', random, null, 200],
  ['signed-in user reads wa_reminder_config (Fonnte token)', 'GET', 'system_status/wa_reminder_config', random, null, 403],
  ['signed-in user reads reminder logs', 'GET', 'system_status/wa_reminder_config/logs/l1', random, null, 403],
  ['unauthenticated reads ai_limit_tracker', 'GET', 'system_status/ai_limit_tracker', null, null, 403],
  ['signed-in account without profile reads ai_limit_tracker', 'GET', 'system_status/ai_limit_tracker', attacker, null, 403],
];

let failed = 0;
for (const [name, method, path, auth, body, expected] of cases) {
  const status = await call(method, path, auth, body);
  const ok = status === expected;
  if (!ok) failed++;
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'} ${name}: got ${status}, expected ${expected}`);
}
if (label === 'new') process.exit(failed ? 1 : 0);
