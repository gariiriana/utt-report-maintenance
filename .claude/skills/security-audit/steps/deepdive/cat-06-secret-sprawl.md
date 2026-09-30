# Deep Dive #6 — Secret Sprawl

**Category.** `secret_sprawl`.

**OWASP tags.**
- ASVS: V2.10 (Service Authentication — credentials in config), V14.5
  (Validation of Config).
- API Top 10: `API8:2023`.

**Baseline CWEs:** 200, 522, 532, 538, 798.

---

## Invariants

1. No secrets tracked in git — `.env*` files, `*.pem`, `*.key`, `*.pfx`,
   `id_rsa*`, `*_rsa`, `credentials.json`.
2. No secrets hardcoded in source (cross-ref cat-05 §"Hardcoded keys").
3. No secrets in Dockerfile `ENV` directives that survive to runtime.
4. Kubernetes `ConfigMap` does not contain secret-like values (belongs
   in `Secret`).
5. Terraform state / `.tfvars` with real values not checked in.
6. CI environment-variable dumps (`env`, `printenv`) not executed by
   default in workflows.
7. Logs don't emit token / password / API-key strings.

## ⛔ Reporting rule: never write the value (v2.6.1)

This category is the one that reads live credentials. Everything it produces is
printed into `security-audit-report.md`, which is a **tracked deliverable** in
the repository being audited.

**A finding in this category must never contain the credential itself.** Not in
`description`, not in `attack_scenario`, not in `suggested_fix`, not in a
fenced code block "for context", not partially masked by hand.

Report instead:

| Write this | Not this |
|---|---|
| `tmp/scratch/.env:1` | the line's contents |
| `github_pat`, 40 chars | `ghp_…` with the value |
| `properties.secret_fingerprint` from the Phase 4 scanner row | your own excerpt |
| "value redacted — see `<output_dir>` gate" | a "safe-looking" prefix |

A prefix is not safe. `AKIA…`, `ghp_…`, `sk-ant-…` identify the provider and
narrow a brute force; the last four characters are how the same credential is
recognised across two leaks. If a reviewer needs the value to act, they read it
from the source file at the cited line — which they have, because they own the
repository.

**Why this is a hard rule and not a style preference.** `lib/verify-deliverable.py`
strips `phase-04-scanners/` structurally at Phase 4, so scanner-sourced secrets
cannot reach the report. Prose you write in THIS phase is the path that strip
never sees: the field is free text and the whole point of it is to be read. If you paste a value
here, the write gate will catch it, scrub it, and emit a CRITICAL finding
against **this skill** — the run then reports its own tooling as defective,
which is correct but expensive. Cite the location.

The same rule applies to `verification_probe`: write the request shape, never a
working `Authorization:` header.

## Detection sweeps

### Tracked secret files (git ls-files check)

```
\.env(\..+)?$         # .env, .env.local, .env.production, .env.staging
^id_rsa(\..+)?$       # SSH keys
^id_dsa(\..+)?$
^id_ed25519(\..+)?$
.*\.pem$
.*\.key$
.*\.pfx$
.*\.p12$
credentials\.json
service-account\.json
gcp-.*\.json
aws-credentials
\.npmrc(-.+)?$        # may contain auth tokens
```

For each match, verify it's actually tracked (not just in the working
tree). Flag → **CRITICAL** (for keys/.env with actual content) /
**HIGH** (for .env.example) / CWE-538.

### Vendor-specific token regexes (supplement Phase 4 scanners)

Cross-reference gitleaks and trufflehog output. For each finding in
`phase-04-scanners/gitleaks.slim.json` AND `trufflehog.slim.json`,
create a `secret_sprawl` finding with:
- `confidence: CONFIRMED` (scanner-backed)
- `cwe: "CWE-798"`
- `sources`: `[{kind: "scanner", detail: <scanner>:<ruleId>}]`

If a given file has multiple scanner hits for the same line, merge.

### Dockerfile ENV secrets

Grep Dockerfiles for:
```
^ENV\s+(?:.*_KEY|.*_SECRET|.*_TOKEN|.*_PASSWORD|API_KEY|JWT_SECRET)\s*=?\s*["']?[A-Za-z0-9_\-]{8,}
```

→ **HIGH** / CWE-538. Suggest: use build-time secrets (`RUN --mount=type=secret`)
or runtime env injection from orchestrator.

### Kubernetes ConfigMap leak

For each `kind: ConfigMap` manifest, check data keys for names matching
secret patterns. Flag → **HIGH** / CWE-538 (should use `Secret`).

### Terraform / IaC

Grep `.tfvars` files for tokens / keys / passwords. If tracked, flag
→ **CRITICAL**.

State files (`.tfstate`, `.tfstate.backup`) tracked in git → **CRITICAL**
/ CWE-538.

### CI plaintext secrets

grep `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`
for literal-looking secrets (pattern: assignment of 20+ char string that
isn't a `${{ secrets.X }}` reference).

→ **HIGH** / CWE-798.

zizmor already catches most GHA issues if installed — cross-ref its SARIF.

### Secrets in logs

Pattern (per language):
```
console\.(log|error|info|debug)\s*\([^)]*(?:token|secret|key|password|credential)[^)]*\)
logger\.(info|warn|error)\s*\(.*(?:token|secret|key|password)
log\.(debug|info)\s*\(.*(?:token|secret|api_key)
printf\b.*(?:token|password)
```

→ **HIGH** / CWE-532.

### MCP-config secret sweep

MCP (Model Context Protocol) server configs are a 2026 secret-leak
hotspot — GitGuardian's *State of Secrets Sprawl 2026* found **24,008
secrets in MCP config files** (8.8% still valid). Secrets land in the
`env`, `headers`, `args`, and `Authorization` fields of server
definitions. Sweep these globs:

```
.*[\\/]?\.mcp\.json$
.*[\\/]?mcp\.json$
.*[\\/].cursor[\\/]mcp\.json$
claude_desktop_config\.json$
.*mcp.*\.(?:json|toml)$
```

Within those files, flag literal-looking secret values (not `${VAR}` /
`{{ }}` references) under the secret-bearing keys:

```
(?i)(?:[A-Z0-9_]*(?:TOKEN|API[_-]?KEY|SECRET|PASSWORD|ACCESS[_-]?KEY))["']?\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{12,}
(?i)"Authorization"\s*:\s*"(?:Bearer\s+|Basic\s+|token\s+)?[A-Za-z0-9_\-.=]{12,}
(?i)"(?:env|headers)"\s*:\s*\{
sk-[A-Za-z0-9]{16,}
(?i)(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}
\b(?:AKIA|ASIA)[A-Z2-7]{16}\b
```

- A `*_TOKEN` / `*_API_KEY` / `*_SECRET` / `*_PASSWORD` key whose value is
  a literal high-entropy string (not a `${VAR}` reference) → **HIGH**
  (escalate to **CRITICAL** if the file is git-tracked) / CWE-798 /
  A07:2025.
- An `Authorization` header with an inline `Bearer` / `Basic` literal →
  **HIGH** / CWE-522 / A04:2025.
- Any tracked MCP config containing a literal secret (vs. an env-var
  reference) is leaked-at-rest → **CRITICAL** / CWE-538 / A02:2025.

The `"env"` / `"headers"` object-open patterns are *locators*: when one
matches, inspect the nested values against the literal-secret patterns
above and the Phase 4 scanner hits. Cross-ref `gitleaks` /
`trufflehog` output (their 2026 detector additions cover GitLab
fine-grained PATs, Cloudflare API v2, Datadog, JFrog ref-tokens, etc.)
and reconcile per the "Vendor-specific token regexes" sweep above. See
`cat-11-mcp-agentic.md` for the non-secret MCP attack surface (tool
poisoning, command injection) — this sweep is the *secret-sprawl* slice
only.

*Static-only:* whether a found MCP token is currently **valid/active** is
**out of scope: flag location, defer to human**.

### Secrets in error responses

grep for:
```
res\.json\s*\(\s*\{[^}]*(?:token|apiKey|secret)
throw new Error\s*\(\s*.*(?:token|apiKey).*\)
raise .*(?:token|secret).*
```

Include token / apikey / secret in error message text → **MEDIUM** /
CWE-209.

## Prior audit artifacts are never "noise"

Hits under `<output_dir>/`, `.claude-audit/`, or a legacy `docs/security-audit-*`
path are **not** false positives and must not be added to an ignore list.

Through v2.6.0 this skill wrote verbatim gitleaks snippets into its own tracked
`findings.sarif`, so those paths can hold real, live credentials that the audit
itself committed. The failure mode is specific and has already happened twice on
the same repository: a run flags its predecessor's output, the hits are triaged
as "prior artifact noise" because a security report is *expected* to look full
of secrets, and the reasoning is self-confirming.

Escalate per `steps/phase-04-scanners.md §4.4c`: CRITICAL, CWE-538,
`properties.skill_self_leak = "true"`, and a `suggested_fix` that says **rotate
first, purge history second** — and states that `git rm --cached` plus a
`.gitignore` line removes the file from `HEAD` while leaving the blob and the
live credential reachable in history.

## False-positive notes

- **.env.example / .env.sample** often contains placeholder values. If
  every value is literally `your-api-key-here` / `replace-me`, INFO only.
- **Test fixtures** with `test_token_xyz` → LOW (still risky because
  sometimes copy-pasted into prod config, but not a direct exposure).
- **Public JWT in OIDC discovery documents** (`jwks.json`) is intended
  to be public — not a finding.
- **Logging a hashed secret** (e.g., sha256 of a token for correlation)
  is fine.
- **MCP configs that reference env vars** (`"API_KEY": "${MY_KEY}"` /
  `"${env:TOKEN}"` / `"{{ secrets.X }}"`) are the *correct* pattern — not
  a finding. Only inline literal values are flagged.
- **Example / template MCP configs** (`.mcp.json.example`,
  `mcp.json.sample`, values literally `your-token-here` / `<TOKEN>` /
  `replace-me`) → INFO only.
- **Public, non-secret MCP endpoints** (a plain `"url"` with no auth
  material, or a Bearer value that is a documented public demo token) →
  LOW; confirm with a human rather than treating as CRITICAL.

## Output

`phase-05-secret_sprawl-<partition>.jsonl`.
