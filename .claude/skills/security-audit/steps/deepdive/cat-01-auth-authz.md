# Deep Dive #1 — Auth & Authz

**Role.** Sub-agent loaded via `templates/subagent-prompt.md` with this file
as the `phase-specific-method-body`.

**Category.** `auth`.

**OWASP tags to apply.**
- ASVS: V2 (Authentication), V3 (Session Mgmt), V4 (Access Control),
  V13 (API & Web Service).
- API Top 10: `API1:2023` (BOLA — also see cat-02), `API2:2023` (Broken
  Authentication), `API3:2023` (BOPLA), `API5:2023` (Broken Function
  Authorization).
- LLM Top 10: not applicable.

**Baseline CWEs:** 284, 285, 287, 288, 306, 307, 345, 347, 352, 384, 521,
613, 636, 640, 862, 863.

> **Cross-cutting lens — apply it here.**
> [`lens-availability-integrity.md`](lens-availability-integrity.md). Your gate
> analysis asks *may this principal do this at all*. The lens asks *how many
> times*. An authorised, uncapped creation call is invisible to every rule in
> this file — there is no missing gate, only a missing bound — and it is the
> first half of an availability/integrity chain. File its findings under
> `auth`.

> CVE IDs cited in this file are **class anchors**, not asserted facts —
> verify each against NVD before quoting it in a finding's `sources`
> (cross-ref `lib/known-vuln-versions.md`).

---

## Invariants to verify per surface

1. Every `http | grpc | graphql | websocket | queue_consumer` surface whose
   `data_ops` contains write/delete/exec has `auth_required: true` OR an
   explicit `@Public` marker.
2. Auth middleware is present **before** the handler in the request
   lifecycle — not bypassable by header ordering, method override, or
   framework wildcard routes.
3. Session regeneration occurs on login (`req.session.regenerate`,
   `SessionStore.create_new`, `CookieJar.rotate`). Absence after a
   successful login is a session-fixation risk.
4. OAuth / SSO handlers verify `state` (CSRF prevention) and `nonce`
   (replay prevention).
5. Password reset flows use single-use tokens with ≤60 min expiry and
   server-side invalidation on use.
6. JWT implementations pin the algorithm (`alg: HS256` or `RS256` etc.);
   `alg: none` is never accepted; `alg` is never read from the untrusted
   header.
7. Rate limiting is present on login, registration, password reset,
   2FA verification, and token issuance endpoints.
8. Mass-assignment: update/create endpoints explicitly allow-list the
   fields they accept. No `Object.assign(user, req.body)` patterns; no
   `@ModelAttribute User user` that maps `role`/`isAdmin` from body.
9. Role / scope checks exist on admin endpoints and use `===` or
   equivalent exact comparison, not `includes`/partial match.
10. **Cross-layer enforcement.** When a resource is gated by a control at a
    *discovery* layer (a share-link resolver, a signed-URL minter, a 2FA
    verification step), **every** layer that subsequently serves the resource's
    bytes re-enforces that same gate. A control minted at one layer but not
    consumed on the content-serving path is the control-with-no-enforcer /
    confused-deputy class. Do NOT treat "the identifier (deckId/UUID/token) is
    hard to guess" as a gate — it is handed to clients and is not secret. This
    invariant is checked mechanically by the Phase 6 §6.19 Authorized-Egress
    reconciliation (`lib/validate-egress.py`) over the global sink +
    credential inventories; cat-01 corroborates it per-handler.

## Detection patterns (polyglot)

### Missing auth on write handlers

For every Phase-2 surface row in scope with `flags[]` containing
`NO_AUTH_WRITE` or `AUTH_UNKNOWN`, read the handler (± ~40 lines, not the
whole file unless small) and verify invariant #1. Absence → **HIGH** finding.

### Session regeneration on login

For each handler path matching `login|signin|authenticate` in
`auth.middleware_paths`:
- JS/TS: grep for `req.session.regenerate` / `session.regenerate` /
  `cookies.rotate`.
- Python: grep for `request.session.cycle_key()` (Django),
  `session.regenerate_id()` (Flask-Session).
- Rails: `reset_session`.
- Spring: `SecurityContextHolder.clearContext()` + new session.

Missing → **MEDIUM** / CWE-384 session fixation.

### JWT algorithm pinning

Grep for:
```
verify\s*\(\s*token\s*,\s*[^,]+\s*(?:,\s*\{[^}]*algorithm[^}]*\})?
jwt\.decode\s*\(\s*token\s*[^,)]*\)
algorithms\s*=\s*\["?HS256\"?\]
```

Flag any call to `jwt.verify`/`jwt.decode` **without** an `algorithms:
[...]` whitelist → **HIGH** / **CWE-347** (Improper Verification of
Cryptographic Signature — the more precise code for missing-algorithm-
whitelist than the generic CWE-327).

Flag any string containing `alg.*none`/`\"alg\":\"none\"` → **CRITICAL** /
**CWE-347**.

### Mass assignment

Grep patterns (per language):
- JS/TS: `Object\.assign\s*\(\s*\w+\s*,\s*req\.body\b`, `...req\.body`
  spread in user update handlers, Sequelize `Model.update(req.body,...)`
  without `fields:` whitelist.
- Ruby/Rails: `update\(params\[:.+\]\)` without `permit(...)`.
- Python/Django: `SerializerClass(instance, data=request.data, partial=True).save()` where serializer has no `Meta.fields` whitelist.
- Java/Spring: `@ModelAttribute` on an entity that includes `role` /
  `isAdmin`.

Matches → **HIGH** / CWE-915.

### OAuth state / nonce

Grep for `oauth|passport|openid|auth0|clerk` usage, verify:
- Request URL includes `state=` parameter.
- Callback validates `state` matches the session-stored value.
- If OIDC: validates `nonce` on the ID token.

Missing → **HIGH** / CWE-352 (CSRF on OAuth flow).

### Rate limiting on sensitive endpoints

Phase 0 surface-row paths matching `/login|/signin|/register|/signup|/password|/reset|/forgot|/mfa|/2fa|/otp|/token|/tokens|/apikeys|/apikey` must have a rate-limit middleware in their registration chain. Grep for:
- `express-rate-limit`, `rateLimit(`
- `django_ratelimit`
- `flask_limiter` / `Limiter`
- `@RateLimit` (Spring via Resilience4j)
- `Rack::Attack`

Missing → **MEDIUM** / CWE-307.

### Admin role enforcement

For every surface with `path` matching `/admin|/super|/internal` or
`roles_required` containing `admin`-flavored values, verify:
- The role check uses exact match (`role === 'admin'`, not
  `role.includes('admin')`).
- The check happens before any data read.

Weak comparison → **HIGH** / CWE-863.

### Framework fail-open auth / matcher-evasion

The headline 2026 auth-bypass class. A middleware/router that uses a
**positive allowlist** ("protect THESE paths, everything else passes")
fails **open**: any request that doesn't match the protect-list reaches
the handler unauthenticated. The robust shape is **default-deny** —
define the *public* routes and protect everything else. Reference anchor:
Next.js `x-middleware-subrequest` (CVE-2025-29927); live 2026 heirs:
Clerk `createRouteMatcher` (CVE-2026-41248), Spring Security servlet-path
matcher bypass (CVE-2026-22753/22754), Spring Boot Actuator prefix-policy
leakage (CVE-2026-22731/22733).

Next.js middleware matcher / subrequest bypass:
```
export\s+const\s+config\s*=\s*\{[^}]*matcher
matcher\s*:\s*\[
x-middleware-subrequest
```
Flag a `matcher` config that lists protected paths (auth only runs on
matched routes — unmatched routes are public). Treat the trusted internal
`x-middleware-subrequest` header as a bypass primitive on unpatched Next
(<12.3.5 / <13.5.9 / <14.2.25 / <15.2.3). → **HIGH** / **CWE-636** (the
positive-allowlist fails open) + **CWE-306** (missing authn on the
unmatched routes).

Clerk `createRouteMatcher` protect-some idiom:
```
createRouteMatcher\s*\(
clerkMiddleware\s*\([^)]*isProtectedRoute
```
The vulnerable shape matches *protected* routes then calls
`auth().protect()` only inside `if (isProtectedRoute(req))` — unmatched =
public. SAFE shape (LOWER severity / defense-in-depth note): the matcher
names PUBLIC routes and code protects the negation, e.g.
```
if\s*\(\s*!\s*isPublicRoute\s*\(
```
→ **HIGH** / **CWE-636** + **CWE-287** when the protect-some idiom is
present (raise confidence if `@clerk/nextjs` <7.2.1 / <6.39.2 / <5.7.6 in
the lockfile; see `cat-04-mitm.md` and Phase-4 SCA for version pins);
**MEDIUM** when only the idiom is present on a current version.

Spring Security matchers excluded by servlet path:
```
securityMatcher\s*\(\s*["']/[^"']+["']
<intercept-url\s+pattern\s*=
```
A rule for `/admin/**` can be bypassed by a request resolving to
`/myservlet/admin/...` when the matcher drops the servlet-path component.
Also flag Actuator-prefix leakage where an app route is declared under an
Actuator-owned prefix:
```
management\.endpoint\.health\.group\.[^.]+\.additional-path
/cloudfoundryapplication
```
→ **HIGH** / **CWE-636** + **CWE-306**.

Express/Koa/Fastify auth middleware mounted on specific paths only:
```
app\.use\s*\(\s*["']/[^"']+["']\s*,\s*\w*[Aa]uth
router\.use\s*\(\s*["']/[^"']+["']\s*,
```
Path-scoped auth (`app.use('/api', requireAuth)`) leaves every other
mount point public. Prefer a global guard with an explicit public-route
allowlist. → **HIGH** / **CWE-636** + **CWE-306** when write/exec surfaces
sit outside the guarded prefix; **MEDIUM** as a hardening note otherwise.

> Generalizable rule (all frameworks): positive-allowlist auth =
> fail-open. Recommend **default-deny** in every `suggested_fix`.

### SAML signature-wrapping (XSW)

SAML response processing that validates a signature but then consumes
assertions/attributes from a **different, unsigned (wrapped)** element —
the signature covers element A while the application trusts element B.
Enabled by missing canonicalization/reference checks, comment-preserving
c14n, or two different XML parsers in one validation path (parser
differential). 2026 resurgence: ruby-saml (CVE-2025-66567/66568),
authentik (CVE-2026-47201), SAP NetWeaver (CVE-2026-44748, 9.9);
PortSwigger "The Fragile Lock" (void canonicalization, attribute
pollution, namespace confusion).

Config-level tells (highest static value):
```
wantAssertionsSigned\s*[=:]\s*false
wantResponseSigned\s*[=:]\s*false
xml-c14n[^"'#]*#WithComments
```
Reference/element-trust tells — a signature check followed by an assertion
read that is not pinned to the signed/validated reference:
```
(validateSignature|verifySignature|checkSignature)\s*\(
getElementsByTagName\s*\(\s*["']Assertion["']
```
Comment-preserving c14n (`#WithComments`) should be exclusive
canonicalization (`#xml-exc-c14n`). Two XML parsers (e.g. ReXML +
Nokogiri, libxml2 + a hand-rolled extractor) in the same validation path
is the differential signal. → **HIGH** / **CWE-347** (Improper
Verification of Cryptographic Signature). Whether two parsers actually
diverge on a crafted payload is **defer-to-human** (needs differential
fuzzing) — flag the enabling config/shape with `confidence: POSSIBLE`.

### JWT header-trust + missing iss/aud

Beyond invariant #6 (`alg: none`, no algorithm allowlist), flag JWT
verification that **trusts attacker-controlled header fields** or **omits
issuer/audience checks**. 2026 regressions: fast-jwt PEM-anchor bypass
(CVE-2026-34950), Hono alg-from-header (CVE-2026-22817), PyJWT
JWK-as-HMAC (CVE-2026-48526), Parse Server `alg:none`+lax `kid`
(CVE-2026-27804), Camel-Keycloak missing `iss` (CVE-2026-23552).

`alg:none` acceptance and alg-confusion (RS256 verified as HS256 with the
public key as the HMAC secret — a mixed-family allowlist enables it):
```
["']?alg["']?\s*[:=]\s*["']none["']
algorithms\s*=\s*\[[^\]]*HS\d+[^\]]*(RS|ES|PS)\d+
createVerifier\s*\(\s*\{(?![^}]*\balgorithms\b)
```
Trusting attacker-controlled `kid`/`jku`/`x5u`/`jwk` from the token
header (key fetched from an attacker URL, or `kid` flowing into a file
read / SQL lookup):
```
(header|protectedHeader|decoded(\.header)?)\.(jku|x5u|jwk|x5c)
header\.kid\b
```
Verification that omits `issuer`/`audience` binding — flag a verify/decode
call whose options block has no `iss`/`aud`:
```
(verify|decode)\s*\([^)]*\)(?![\s\S]{0,200}(issuer|iss|audience|aud))
```
→ **CRITICAL** / **CWE-347** for `alg:none`, alg-confusion, and
`jku`/`x5u`/`kid` header-trust; **HIGH** / **CWE-345** (Insufficient
Verification of Data Authenticity) for missing `iss`/`aud` validation.

### Consistency-with-a-sibling is NOT proof of correctness

When a handler mirrors a sibling endpoint's access-control pattern ("this serves
content the same way `build-output` does"), do **not** conclude it is safe because
it is *consistent*. Consistency with a flawed baseline reproduces the flaw and
reads as correct — this is exactly how the deck-2FA gap propagated to a second
endpoint and passed two reviews. Audit the **sibling's** correctness against the
resource's intended gate; if the sibling is wrong, both are wrong. When a finding
involves a resource served by multiple endpoints, set `related_partitions[]` and
defer the cross-endpoint verdict to §6.19.

## False-positive notes

- **Test handler routes** (`/test/...`, `/__test__/...`) are often
  authenticated via test-only middleware; verify the middleware is
  NOT wired in production (`if (env.TEST)` guards).
- **Health / metrics endpoints** may legitimately skip auth; do not flag
  `/health`, `/healthz`, `/ready`, `/metrics` unless they expose process
  internals.
- **Framework-generated boilerplate** (e.g., NextAuth `[...nextauth].ts`)
  sometimes appears to skip auth because auth IS the endpoint's purpose.

## Output

Write JSONL findings to:
```
.claude-audit/current/phase-05-auth-<partition_id>.jsonl
```

Each line matches `lib/finding-schema.json`. Example:

```json
{"id":"juice-shop:auth:0001","severity":"HIGH","confidence":"LIKELY","category":"auth","partition":"juice-shop","file":"routes/login.ts","line":42,"cwe":"CWE-287","owasp_ids":["ASVS-V2.1.1","API2:2023"],"title":"JWT verification missing algorithm whitelist","description":"...","sources":[{"kind":"grep","detail":"jwt-verify-no-alg-whitelist"}],"suggested_fix":"Pass {algorithms: ['HS256']} to jwt.verify().","attack_scenario":"Attacker crafts a token with alg:none that verifies without a signature."}
```

Emit completion marker when done:
```
.claude-audit/current/phase-05-auth-<partition_id>.done
```
