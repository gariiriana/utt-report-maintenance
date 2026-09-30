# Phase 3 — Keystone File Index

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/cache/keystone-files.json` (global list of cross-cutting files: middleware, auth config, CORS config, error handlers)
- `.claude-audit/current/phase-03.done`

⛔ **DO NOT advance to Phase 4** until both files exist AND the Verify block at the bottom prints `phase-03 verified`.

📖 Keystone index feeds Phase 5 sub-agents — they grep against this index rather than re-scanning the repo. Missing keystone list ⇒ each sub-agent burns tokens re-discovering middleware.

---

**Goal.** Identify files whose modification invalidates many audit rows at
once — auth middleware, session config, crypto bootstrap, CORS/CSP policy,
error handlers, config loaders. These are **keystone files**. Delta mode
(Phase 8 + `mode: delta`) uses the index to cascade invalidation; a change
to an auth middleware invalidates every route in the auth matrix, not just
the middleware's file.

**Inputs.**
- `.claude-audit/current/phase-00-profile.json`
- `.claude-audit/current/phase-02-surface.json`
- `.claude-audit/current/partitions.json`

**Output.** `.claude-audit/cache/keystone-files.json` (note: the cache/
directory, not current/ — this index is intended to persist across runs).
Plus `.claude-audit/current/phase-03.done`.

**Execution model.** Single orchestrator pass. Phase 3 is cheap and benefits
from holding the whole profile + surface in context; no sub-agent fan-out.

---

## 3.1 — Seed paths from Phase 0

Start with every path in:
- `profile.auth.middleware_paths[]`
- `profile.data_model.schema_files[]`
- `profile.deployment.docker.compose[]` (if any)
- `profile.deployment.k8s.manifests[]` (top-level only — Deployment/Ingress)
- `profile.deployment.ci.github_actions[]` + `gitlab_ci[]` (CI workflows)

Every seed becomes a keystone candidate with `reasons` pre-populated from its
Phase 0 source.

## 3.2 — Grep-based expansion

For each partition in `partitions.json`, run the following detection sweeps
(globs constrained to `paths_included`, ignoring `paths_excluded`):

### Auth / session / guard exports

Look for files whose exports include an identifier matching:
```
^(current_?user|get_?session|auth_?guard|require_?auth|authorize|authenticate|is_?authenticated|with_?auth|protected|session_?manager|jwt_?verify)$
```

**Detection** (language-agnostic):
- JS/TS: `export function X`, `export const X`, `export default function X`, `module.exports.X`, `exports.X =`
- Python: top-level `def X(`, `def X(...)` in `__init__.py`
- Go: capitalized top-level `func X(`
- Rust: `pub fn X(` / `pub async fn X(`
- Java/Kotlin: `public <type> X(` in a class annotated `@Component`/`@Service`/`@Bean`
- Ruby: `def self.X` in a module / class method
- PHP: `public function X` in a class with `namespace ...Middleware`

Tag each hit with `reasons: ["auth_export:<symbol>"]`.

### Config loaders (whole-app config)

Exact paths:
```
nuxt.config.ts, nuxt.config.js, nuxt.config.mjs
next.config.ts, next.config.js, next.config.mjs
vite.config.ts, vite.config.js
svelte.config.js
astro.config.*
settings.py, config/settings/*.py
application.yml, application.properties, application-*.yml
config/*.ts, config/*.js, config/default.*
src/config/*.ts
appsettings.json, appsettings.*.json
config.rb, config/application.rb, config/environments/*.rb
Rocket.toml, rocket.toml
```

Tag with `reasons: ["config_loader"]`.

### Crypto bootstrap / JWT verifier / cipher factory

Any file exporting / declaring:
- `jwt.verify`, `jwtVerifier`, `SignatureVerifier`, `TokenVerifier`
- `cipher`, `Cipher`, `aesKey`, `encryptionKey`, `signer`, `Signer`
- `createCipheriv`, `createDecipheriv`, `Cipher.getInstance`
- `MessageDigest.getInstance`, `hashPassword`, `verifyPassword`, `scrypt`, `argon2`, `pbkdf2`, `bcrypt`

Tag with `reasons: ["crypto_export:<symbol>"]`.

### CORS / CSP / security-header config

Any file containing:
- `cors()` invocation (Express-style) with options object
- `Access-Control-Allow-*` string literals
- `helmet()` invocation
- `Content-Security-Policy` header construction
- `routeRules: { ... cors: ... }` (Nuxt)
- `security_middleware` (Django), `SecureHeaders` (Rails)

Tag with `reasons: ["cors_config"]` or `["csp_config"]`.

### Error handlers / exception middleware

Any file containing:
- `errorHandler`, `errorMiddleware`
- `ExceptionHandler`, `@ControllerAdvice` (Spring)
- `DEBUG = True` (Django) — flag as keystone with reason `debug_flag`
- `rescue_from` (Rails)
- `defineNitroErrorHandler` (Nuxt)

Tag with `reasons: ["error_handler"]`.

### Feature flags / environment accessors

Files that centralize env-var reads:
- `import.meta.env` / `process.env` only at dedicated config module
- `useRuntimeConfig()` (Nuxt)
- `os.environ` centralized in `settings.py`

Tag with `reasons: ["env_loader"]`. (Lower priority but still a keystone
because an env-var typo cascades everywhere.)

## 3.3 — Union, deduplicate, tag

Merge all hits by path. For each unique path, collect all `reasons[]` and
union them. Sort by reason count descending (files with multiple reasons go
to the top).

## 3.4 — Emit the index

Write to `.claude-audit/cache/keystone-files.json`:

```json
{
  "schema_version": 2,
  "skill_version": "...",
  "audit_id": "...",
  "generated_at": "...",
  "keystone_files": [
    {
      "path": "lib/insecurity.ts",
      "partitions": ["juice-shop"],
      "reasons": ["auth_export:getCurrentUser", "crypto_export:verifyToken"]
    },
    {
      "path": "server.ts",
      "partitions": ["juice-shop"],
      "reasons": ["cors_config", "error_handler"]
    }
  ]
}
```

Write `.claude-audit/current/phase-03.done`.

## 3.5 — Invalidation semantics (used by delta mode in M6)

A downstream invalidator reads `keystone-files.json` and applies:

- **Any keystone file changed** → invalidate the entire auth matrix (Phase 5
  category 1) and re-run Phase 6 config audit in full.
- **Config loader changed** → invalidate Phase 6 and every surface whose
  `auth_middleware` list includes a loader-derived symbol.
- **Crypto export changed** → invalidate Phase 5 category 5 for every
  partition that imports the crypto module.

This phase does not perform invalidation itself — it only produces the
lookup index. M6 consumes it.

## 3.6 — Report to user

> Phase 3 complete — indexed <N> keystone files across <M> partitions.
> Top reasons: <reason histogram>. Proceeding to Phase 4 (Scanners).

## 3.7 — Edge cases

- **No auth system detected.** If `profile.auth.middleware_paths` is empty
  and no grep hits fire, emit `keystone_files: []` with an entry in `notes`
  so delta mode falls back to "invalidate everything on any change".
- **Very large config loaders.** If a file matches the `config_loader`
  pattern but is >1000 lines, tag it with a second reason `oversize_config`
  so M6 documentation can suggest splitting it.
- **Shared keystone across partitions.** A library-level auth file imported
  by multiple partitions. Record all partitions in the `partitions[]` field;
  delta invalidation then cascades into each.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/../cache/keystone-files.json  \
  && test -f .claude-audit/current/phase-03.done \
  && echo "phase-03 verified" \
  || { echo "phase-03 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-03 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
