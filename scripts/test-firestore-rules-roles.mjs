// Differential Firestore rules test per role — emulator only (demo- project, no production access).
// Collects every rule whose only condition is sign-in / isKnownUser() (plus !isDrafter()), sends the same
// requests as each identity below, and compares two runs (e.g. deployed rules vs working tree):
//   firebase emulators:exec --only firestore --project demo-dwimitra "node scripts/test-firestore-rules-roles.mjs run <out.json>"
//   node scripts/test-firestore-rules-roles.mjs compare <before.json> <after.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT = 'demo-dwimitra';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const RULES = join(import.meta.dirname, '..', 'firebase', 'firestore.rules');

// [name, uid, email, users/{uid}.role (null = no profile), role custom claim]
const IDENTITIES = [
  ['anon', null, null, null, null],
  ['unknown', 'u-unknown', 'outsider@test.io', null, null],
  ['unknown-engineer-email', 'u-unknown-eng', 'me.genset@test.io', null, null],
  ['drafter', 'u-drafter', 'drafter@test.io', 'drafter', 'drafter'],
  ['engineer', 'u-engineer', 'teknisi1@test.io', 'engineer', null],
  ['engineer-k2', 'u-k2', 'k2user@test.io', 'Engineer_K2', null],
  ['standby', 'u-standby', 'agil@utt.com', 'standby_engineer', null],
  ['dwimitra', 'u-dwimitra', 'dwimitra@co.id', 'engineer', null],
  ['qcdme-no-profile', 'u-qc', 'qcdme@dme.com', null, null],
  ['hse', 'u-hse', 'hse@gmail.com', 'hse', null],
  ['dme', 'u-dme', 'dme1@test.io', 'DME', null],
  ['site-manager-dme', 'u-smdme', 'smdme@test.io', 'site_manager_dme', null],
  ['admin', 'u-admin', 'admin1@test.io', 'admin', null],
  ['director', 'u-dirut', 'dirut@test.io', 'dirut', null],
];

// First profile created by the user themselves: [name, uid, email, role (null = no role field)]
const SIGNUPS = [
  ['self-standby-unlisted-email', 'n-1', 'baru1@test.io', 'standby_engineer'],
  ['self-engineer', 'n-2', 'baru2@test.io', 'engineer'],
  ['self-admin', 'n-3', 'baru3@test.io', 'admin'],
  ['self-standby-listed-email', 'n-4', 'riyan@utt.com', 'standby_engineer'],
  ['self-k2-k2-email', 'n-5', 'k2baru@test.io', 'Engineer_K2'],
  ['self-k2-other-email', 'n-6', 'baru6@test.io', 'Engineer_K2'],
  ['self-no-role', 'n-7', 'baru7@test.io', null],
];

// Only these identities may lose access between runs.
const EXPECTED_LOSS = new Set(['unknown', 'unknown-engineer-email', 'self-standby-unlisted-email', 'self-k2-other-email']);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function idToken(uid, email, role) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: now, exp: now + 3600, auth_time: now,
    sub: uid, user_id: uid, email, email_verified: false, firebase: { sign_in_provider: 'password', identities: {} },
  };
  if (role) claims.role = role;
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
}

async function call(method, path, auth, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(`${BASE}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.status;
}

const fields = (obj) => ({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { stringValue: String(v) }])) });

// Rules whose whole condition is `[!isDrafter() && ](request.auth != null | isKnownUser())`, with their full match path.
function signInOnlyRules(text) {
  const found = [];
  const stack = [];
  const signInOnly = /^\s*allow\s+([a-z, ]+):\s*if\s+(?:!isDrafter\(\)\s*&&\s*)?\(?\s*(?:isKnownUser\(\)|request\.auth\s*!=\s*null)\s*\)?\s*;\s*$/;
  text.split(/\r?\n/).forEach((raw, i) => {
    const m = signInOnly.exec(raw);
    if (m) {
      const path = stack.filter(Boolean).slice(1).join('');
      if (!path.includes('=**')) found.push({ line: i + 1, path, ops: m[1].split(',').map((s) => s.trim()) });
    }
    let code = raw.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const mm = /match\s+(\S+)\s*\{/.exec(code);
    let pending = mm ? mm[1] : null;
    if (mm) code = code.replace(mm[0], 'match {');
    for (const ch of code) {
      if (ch === '{') { stack.push(pending); pending = null; } else if (ch === '}') stack.pop();
    }
  });
  return found;
}

function concrete(path, docId) {
  const segs = path.split('/').filter(Boolean);
  return segs.map((s, i) => (/^\{.+\}$/.test(s) ? (i === segs.length - 1 ? docId : 'p1') : s)).join('/');
}

const OPS = { read: ['get', 'list'], write: ['create', 'update', 'delete'] };
const expand = (ops) => [...new Set(ops.flatMap((o) => OPS[o] || [o]))];

async function run(out) {
  const rules = signInOnlyRules(readFileSync(RULES, 'utf8'));
  const tokens = Object.fromEntries(IDENTITIES.map(([name, uid, email, , claim]) => [name, uid ? idToken(uid, email, claim) : null]));
  for (const [, uid, email, role] of IDENTITIES) if (uid && role) await call('PATCH', `users/${uid}`, 'owner', fields({ role, email }));

  const results = [];
  for (const rule of rules) {
    for (const [name] of IDENTITIES) {
      await call('PATCH', concrete(rule.path, `t-${name}`), 'owner', fields({ x: '0' }));
      await call('PATCH', concrete(rule.path, `d-${name}`), 'owner', fields({ x: '0' }));
    }
    for (const [name] of IDENTITIES) {
      for (const op of expand(rule.ops)) {
        const target = concrete(rule.path, `t-${name}`);
        const [method, path, body] = {
          get: ['GET', target],
          list: ['GET', `${target.split('/').slice(0, -1).join('/')}?pageSize=1`],
          create: ['PATCH', concrete(rule.path, `c-${name}`), fields({ x: '1' })],
          update: ['PATCH', target, fields({ x: '2' })],
          delete: ['DELETE', concrete(rule.path, `d-${name}`)],
        }[op];
        results.push({ key: `${name}|${op}|${rule.path}`, identity: name, line: rule.line, status: await call(method, path, tokens[name], body) });
      }
    }
  }

  for (const [name, uid, email, role] of SIGNUPS) {
    const status = await call('PATCH', `users/${uid}`, idToken(uid, email), fields(role ? { role, email } : { email }));
    results.push({ key: `${name}|create|/users/{userId}`, identity: name, status });
  }
  for (const [name, uid] of IDENTITIES) {
    results.push({ key: `${name}|list|/users`, identity: name, status: await call('GET', 'users?pageSize=1', tokens[name]) });
    results.push({ key: `${name}|get-other|/users/{userId}`, identity: name, status: await call('GET', 'users/u-engineer', tokens[name]) });
    if (uid) results.push({ key: `${name}|get-own|/users/{userId}`, identity: name, status: await call('GET', `users/${uid}`, tokens[name]) });
  }

  writeFileSync(out, JSON.stringify({ rules: rules.length, results }));
  console.log(`rules=${rules.length} requests=${results.length} -> ${out}`);
}

const verdict = (s) => (s === 200 || s === 404 ? 'allow' : s === 403 ? 'deny' : `http${s}`);

function compare(beforeFile, afterFile) {
  const load = (f) => new Map(JSON.parse(readFileSync(f, 'utf8')).results.map((r) => [r.key, r]));
  const before = load(beforeFile);
  const after = load(afterFile);
  let unchanged = 0;
  const expected = {};
  const unexpected = [];
  for (const [key, a] of after) {
    const was = before.has(key) ? verdict(before.get(key).status) : 'missing';
    const now = verdict(a.status);
    if (was === now) unchanged++;
    else if (was === 'allow' && now === 'deny' && EXPECTED_LOSS.has(a.identity)) expected[a.identity] = (expected[a.identity] || 0) + 1;
    else unexpected.push(`${key}${a.line ? ` (line ${a.line})` : ''}: ${was} -> ${now}`);
  }
  const lockedOut = [...after.values()].filter((r) => r.line && !['anon', 'drafter', ...EXPECTED_LOSS].includes(r.identity) && verdict(r.status) !== 'allow');
  console.log(`compared=${after.size} unchanged=${unchanged}`);
  console.log(`expected allow->deny: ${JSON.stringify(expected)}`);
  console.log(`internal identities not allowed on sign-in-only rules: ${lockedOut.length}`);
  lockedOut.slice(0, 10).forEach((r) => console.log(`  ${r.key} (line ${r.line}): ${r.status}`));
  console.log(`unexpected changes: ${unexpected.length}`);
  unexpected.slice(0, 40).forEach((u) => console.log(`  ${u}`));
  process.exit(unexpected.length || lockedOut.length ? 1 : 0);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === 'run') await run(a);
else if (mode === 'compare') compare(a, b);
else console.log('usage: run <out.json> | compare <before.json> <after.json>');
