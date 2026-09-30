# Deep Dive #3 — Token / API Key Scope

**Category.** `token_scope`.

**OWASP tags.**
- ASVS: V2.10 (Service Authentication), V13.2 (REST Web Service — API
  Key / Token scope).
- API Top 10: `API1:2023` (BOLA — redirect_uri token theft / scope-at-use),
  `API2:2023`, `API5:2023` (Broken Function Authorization — wildcard/
  use-time scope), `API10:2023` (Unsafe Consumption of APIs).

**Baseline CWEs:** 285, 287, 522, 538, 598, 601, 798, 862, 863.

> CVE IDs cited in this file are **class anchors**, not asserted facts —
> verify each against NVD before quoting it in a finding's `sources`
> (cross-ref `lib/known-vuln-versions.md`).

**Gate.** Skip the whole category if neither `profile.auth.kinds` nor
`phase-02-surface.json` show token / PAT / API-key mechanisms. Record
`notes: "no token system detected — category skipped"` in the sub-agent's
RETURN SHAPE.

---

## Invariants to verify

1. Every PAT / API key is created with an explicit scope list; no `"*"` /
   `"all"` wildcard.
2. Scopes are enforced at **both** creation (creator can't grant broader
   than their own scope) and use (handler verifies token.scope ⊇ required).
3. The scope string format is consistent — if the codebase uses `read:x`
   alongside `x.read`, the inconsistency is a finding.
4. Tokens expire (explicit TTL) AND expiry is checked on every request.
5. Revocation is a first-class operation; revoked tokens fail within one
   request cycle.
6. Tokens are not transmitted in URL query strings (logged by
   intermediaries) — only in `Authorization` headers.
7. Token creation endpoints are rate-limited (see cat-01 §"Rate limiting").
8. New tokens inherit the issuer's role or lower — never higher.

## Discovery (once per audit)

1. **Where are tokens issued?** grep for:
   `createToken|issueToken|generateToken|signToken|apiKey|personal.access`
2. **What scopes exist?** grep definitions:
   `scope|scopes|SCOPES|Permissions|PERMISSIONS|Capability`
3. **Where are tokens validated?** Phase 0's `auth.middleware_paths` +
   additional grep for `validateToken|verifyToken|checkApiKey|bearer`.

Build a **Scope × Endpoint matrix** locally (in-sub-agent, not persisted
unless findings emerge). For each endpoint requiring a token, note the
required scope and the actually-enforced scope. Mismatches are findings.

> **v2.4 — the persisted, cross-partition version of this matrix is the global
> credential ledger** (`phase-02-credentials.json`) reconciled in Phase 6 §6.19.
> This in-sub-agent matrix is per-partition and was historically *not persisted*,
> which is exactly why a credential minted in one partition and ignored in
> another (the deck-2FA bug) escaped. When you find a token/claim whose
> writer and consumer span partitions, ensure it is represented in the ledger
> (`writers[]`, `readers[]`, `protects_resources[]`) so §6.19 can reconcile it —
> a "minted but never consumed on the byte path" claim is the headline finding.

## Detection patterns

### No scope check — endpoint accepts any valid token

Pattern: handler reads `Authorization` header / `req.user.token`, calls
`validateToken(...)`, then proceeds **without** inspecting
`token.scope`/`token.scopes`/`token.permissions`. Flag → **HIGH** /
CWE-285.

### Wildcard default scope

```typescript
const token = await createToken({ scopes: scopes || ['*'] });
const apiKey = generateApiKey({ permissions: req.body.permissions ?? 'all' });
```
→ **HIGH** / CWE-732.

### Scope inheritance — creation does not limit to issuer's scope

Token creation handler accepts an arbitrary scope list from `req.body`
without verifying `requestedScopes ⊆ issuer.scopes`. → **HIGH** / CWE-285.

Pattern: grep for `createToken` call sites where `req.user` is used but
the handler does not intersect scopes.

### Scope check uses `includes` / partial match

```go
if strings.Contains(token.Scope, "read") { ... }
```

vs the correct `slices.Contains(token.Scopes, "read:users")`. Flag as
**MEDIUM** / CWE-863.

### Token in URL

grep for:
- `?token=`, `?api_key=`, `?apiKey=`, `?access_token=` in logged URLs,
  Ajax calls, redirect URLs.
- Backend handler reading `req.query.token` / `request.GET.get('token')`.

Both emissions and ingestions are findings. → **MEDIUM** / CWE-598
(SDLC — sensitive info in URL) / CWE-200.

### No expiry / never-expires tokens

- JWT issued with `exp` missing OR set to absurd future (`Number.MAX_SAFE_INTEGER`, `9999999999`).
- Database-stored tokens with `expires_at` column nullable and nullable is the norm.

→ **MEDIUM** / CWE-613.

### No revocation path

- No revocation endpoint (`DELETE /tokens/:id`, `POST /tokens/revoke`).
- Revocation endpoint exists but the validation middleware doesn't
  re-check the revocation list on each request.

→ **MEDIUM** / CWE-613.

### Admin scope bypass

Admin endpoints that accept any authenticated token rather than one with
`admin:*` / `role:admin` scope. → **HIGH** / CWE-863.

### Token leakage in logs / responses

grep for:
- `console.log(.*token)`, `logger.(info|debug).*token`, `log.*apiKey`
- `res.json({ ..., token })` on non-auth endpoints
- Error messages including token values

→ **HIGH** / CWE-532.

### Scope naming inconsistency

If different files check `'items:read'` / `'read:items'` / `'read_items'`
for the same resource, the inconsistency creates a bypass surface. Flag
→ **MEDIUM** / CWE-285.

### Exact redirect_uri validation (OAuth/OIDC)

When an OAuth/OIDC authorization or token endpoint validates the
`redirect_uri` with a **prefix / substring / `startsWith` / `endsWith` /
regex** check instead of an **exact** string match against a registered
URI, an attacker can register `https://good.example.com.evil.com` (suffix
miss) or `https://good.example.com/../evil` (prefix miss) and steal the
authorization code / token via open redirect. 2026 reference: Backstage
`redirect_uri` allowlist bypass (CVE-2026-32235); IETF OAuth security-
topics update adds Audience Injection / cross-tool ATO.

```
redirect_?uri[\s\S]{0,40}\.(startsWith|endsWith|includes|indexOf|match|test|search)\s*\(
redirect_?uri[\s\S]{0,40}\.(startsWith|endsWith)\s*\(
```
Also flag regex anchoring mistakes (unanchored or `.` not escaped in the
host) and `LIKE 'https://app%'` style DB lookups. SAFE shape: an O(1)
exact lookup of the full URI in the registered set
(`registered.has(redirect_uri)` / `redirect_uri === registered`). →
**HIGH** / **CWE-601** (URL Redirection to Untrusted Site). PKCE-downgrade
nearby (`response_type=code` issued without `code_challenge`) raises
confidence.

### Scope enforced at grant AND use; no wildcard scopes

Two distinct failures, both flagged here. (1) Tokens / PATs minted with a
`*` / `all` wildcard scope — invariant #1. (2) Endpoints that verify the
caller is **authenticated** but never check the token's **scope at
use-time** — invariant #2's use-side. A token must be scope-checked at
*both* grant (creator can't exceed their own scope) and use (handler
asserts `token.scope ⊇ required`).

Wildcard scope at mint (augments §"Wildcard default scope"):
```
scopes?\s*[:=]\s*\[?\s*["']\*["']
(permissions?|scopes?)\s*[:=]\s*["'](all|\*)["']
scopes?\s*[:=]\s*scopes?\s*\|\|\s*\[?\s*["']\*["']
```
→ **HIGH** / **CWE-862** (Missing Authorization — the wildcard grants
unscoped capability).

Authenticated-but-not-scope-checked at use: the handler resolves
`req.user` / validates the bearer token, then performs a privileged
read/write without asserting the required scope. Detect the
authn-without-authz shape, then confirm no scope assertion in the same
handler:
```
(validateToken|verifyToken|checkApiKey|getServerSession)\s*\((?![\s\S]{0,400}(scope|scopes|permission|can\())
```
→ **HIGH** / **CWE-863** (Incorrect Authorization).

Where the privileged read is reachable via a `GET` that also carries the
token or returns sensitive data in a cacheable/loggable URL response,
additionally tag **CWE-598** (Use of GET Request Method With Sensitive
Query Strings) — cross-reference §"Token in URL":
```
(app|router)\.get\s*\(\s*["'][^"']*["'][\s\S]{0,200}(token|secret|password|ssn|api_key)
```
→ **MEDIUM** / **CWE-598**.

## Output

Write JSONL to `phase-05-token_scope-<partition_id>.jsonl`.
