# Phase 6 — Config + Methodology Spine

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-06-config.json` (CORS / headers / cookies / errors / env / rate-limit / transport / CI-CD findings)
- `.claude-audit/current/phase-06-asvs.jsonl` (one row per ASVS L2 sub-item where relevant)
- `.claude-audit/current/phase-06-api-top10.jsonl` (per-surface mapping to API Top 10 2023)
- `.claude-audit/current/phase-06-llm-top10.jsonl` — ALWAYS written. If `profile.llm_usage.detected == false` or `kind == "internal"`, write a zero-byte file (the file's presence is the signal that the gate ran).
- `.claude-audit/current/phase-06-web-top10.jsonl` — ALWAYS written. One row per OWASP Top 10:2025 (web) category (A01..A10) with counts + pointers (§6.16). A pure roll-up from existing findings' CWEs; never gated.
- `.claude-audit/current/phase-06-agentic-top10.jsonl` — ALWAYS written. If `profile.mcp_agentic.detected != true`, write a zero-byte file (the file's presence is the signal that the gate ran). Otherwise one row per ASI01..ASI10 (§6.17).
- `.claude-audit/current/phase-06-linddun.jsonl` — ALWAYS written. If `profile.pii.detected == false`, write a zero-byte file.
- `.claude-audit/current/phase-06-stride/*.md` — one Markdown file per top-N partition (filename uses the partition id, e.g. `services-api.md`)
- `.claude-audit/current/phase-06-egress.jsonl` — Authorized-Egress reconciliation findings (§6.19). ALWAYS written; zero-byte only when `phase-02-sinks.json` has no sinks.
- `.claude-audit/current/phase-06-collections.jsonl` — collection-scoping reconciliation findings (§6.20). ALWAYS written; zero-byte only when `phase-02-collections.json` has no collections.
- `.claude-audit/current/phase-06.done`

🔁 **Methodology fan-out is MANDATORY (per §6.9, §6.12, §6.13):**
- ASVS: invoke one Agent sub-agent per ASVS category. Do NOT summarize all ASVS categories in a single pass.
- LINDDUN: invoke a sub-agent per (entity × threat-category) when PII is detected.
- STRIDE: invoke a sub-agent per top-N partition.

⛔ **DO NOT advance to Phase 7** until every file above exists (empty JSONLs are fine for legitimately-gated methodologies) AND the Verify block prints `phase-06 verified`.

📖 Phase 7 synthesis computes the methodology coverage matrix from these JSONLs. Empty-when-shouldn't-be-empty or missing methodology files ⇒ the report's "Methodology Coverage" section is misleading.

---

**Goal.** Audit whole-application configuration (CORS, security headers,
cookies, error handling, env-var exposure, transport config, outbound-
client config, CI/CD pipeline) AND apply the structured OWASP
methodology spines (ASVS, API Top 10, LLM Top 10, LINDDUN, STRIDE).

**Inputs.** All Phase 0-5 artifacts in `.claude-audit/current/`.

**Outputs.**
- `.claude-audit/current/phase-06-config.json` — config findings.
- `.claude-audit/current/phase-06-asvs.jsonl` — ASVS checklist coverage
  per category (one line per ASVS sub-item where relevant).
- `.claude-audit/current/phase-06-api-top10.jsonl` — API Top 10 mapping
  per attack-surface row.
- `.claude-audit/current/phase-06-llm-top10.jsonl` — LLM Top 10 (if LLM
  usage detected; else empty).
- `.claude-audit/current/phase-06-web-top10.jsonl` — OWASP Top 10:2025
  (web) mapping, one row per A01..A10 (always written; roll-up).
- `.claude-audit/current/phase-06-agentic-top10.jsonl` — Agentic
  Applications 2026 coverage (if `mcp_agentic.detected`; else empty).
- `.claude-audit/current/phase-06-linddun.jsonl` — LINDDUN privacy review
  (if PII detected; else empty).
- `.claude-audit/current/phase-06-stride/<partition>.md` — STRIDE table
  per top-N partition.
- `.claude-audit/current/phase-06.done`

**Execution.** Single orchestrator pass for §6.1-6.7 (config). Fan-out
sub-agents for §6.8-6.12 (methodology spines) — one per methodology per
partition, 8 concurrent cap.

---

## 6.1 — CORS configuration

For each detected CORS setup (from `cors_config` keystone tags + Phase 0
data), verify:

| Rule | Severity if violated |
|---|---|
| `origin: "*"` with `credentials: true` | **CRITICAL** / CWE-346 |
| Wildcard origin on authenticated endpoints | **HIGH** |
| Origin validation via `.includes()` / partial match | **HIGH** (bypassable: `evil-example.com` contains `example.com`) |
| Overly permissive methods (PUT/DELETE when GET suffices) | **MEDIUM** |
| Overly permissive headers | **MEDIUM** |
| Missing `Vary: Origin` when origin is dynamic | **LOW** |

Emit one finding per partition where CORS lives. Tag: `category: config`,
`owasp_ids: ["ASVS-V14.5.1", "API8:2023"]`.

## 6.2 — Security headers

Per-partition, verify these headers are set (by the app, or by a
clearly-attached CDN/proxy). Required rubric:

| Header | Expected | Severity if missing |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (≥1 year) | **HIGH** / CWE-319 |
| `X-Content-Type-Options` | `nosniff` | **MEDIUM** |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | **MEDIUM** |
| `Content-Security-Policy` | Defined; `default-src 'self'` or stricter | **MEDIUM** |
| `Referrer-Policy` | `strict-origin-when-cross-origin` or stricter | **LOW** |
| `Permissions-Policy` | Defined (camera, microphone, geolocation) | **LOW** |
| `X-XSS-Protection` | `0` (modern) or absent (legacy OK either way) | **INFO** |

Check sources in priority order: framework config (nuxt.config,
next.config, helmet(), Spring SecurityConfig, django.middleware.security),
reverse-proxy config (if detectable), HTML `<meta>` tags.

## 6.3 — Cookie security

For each cookie-setting call site (grep `setCookie|Set-Cookie|cookie.*options`):

| Attribute | Rule | Severity |
|---|---|---|
| `httpOnly` | MUST be true for session/auth cookies | **HIGH** / CWE-1004 |
| `secure` | MUST be true in prod (or `secure: env === 'production'`) | **HIGH** / CWE-614 |
| `sameSite` | MUST be `Lax` or `Strict` (or `None` with explicit justification) | **HIGH** / CWE-1275 |
| expiry | Session cookies shouldn't exceed 30 days | **MEDIUM** |
| payload | Only session IDs; no PII / tokens in non-HttpOnly cookies | **HIGH** |

## 6.4 — Error handling & info disclosure

For production error paths (grep `stack.trace|err\.stack|createError|throw new Error|catch`):

- Stack traces returned in API responses → **HIGH** / CWE-209.
- Database errors leaked (table names, query syntax) → **HIGH** / CWE-209.
- Distinct 403 vs 404 for IDOR surfaces → **MEDIUM** / CWE-209.
- Debug endpoints accessible when `NODE_ENV != development` → **HIGH** /
  CWE-215.

Cross-reference the profile's deployment CI workflow — if `NODE_ENV` /
`DJANGO_DEBUG` / similar is set at CI but falls through in k8s
manifests, flag.

## 6.5 — Environment variable security

- `.env` / `.env.local` / `.env.production` tracked in git → **CRITICAL** /
  CWE-538 (cross-ref cat-06).
- Client-exposed env vars (`NUXT_PUBLIC_*`, `VITE_*`, `NEXT_PUBLIC_*`)
  that contain secret-looking names → **HIGH**.
- Fallback default for secrets (`process.env.SECRET || 'default-secret'`)
  → **HIGH** / CWE-798.
- `runtimeConfig.public` (Nuxt) or equivalent containing secrets → **HIGH**.

## 6.6 — Rate limiting

Endpoints that SHOULD be rate-limited (from Phase 2 surface inventory):
- Login, register, password reset, 2FA verify, token create, webhook
  receivers, file upload.

Missing rate limit → **MEDIUM** / CWE-307 / CWE-770.

## 6.7 — Transport & outbound-client config

In addition to cat-04 (MITM) findings on outbound TLS clients:
- **Egress proxy** — is one configured? Presence or absence of
  `HTTPS_PROXY` / `NO_PROXY` settings informs M4's SSRF recommendations.
- **IMDS blocking** — in cloud deployments, does the app block
  `169.254.169.254`? Check SSRF defenses centrally.
- **Mixed content** — HTTP endpoints served from HTTPS pages (if SSR
  templates or config show `http://` resource URLs).

## 6.8 — CI/CD configuration

From `profile.deployment.ci.*`:
- **GitHub Actions**: pinned actions (`uses: org/action@sha` not `@v1`),
  workflow-level `permissions:` block, no `pull_request_target` + PR
  head checkout, secrets only in non-fork workflows.
- **GitLab CI**: `protected:` on secret variables, `tags:` restrict
  secret-exposing jobs to trusted runners.
- **CircleCI / Buildkite**: similar — pin versions, scope secrets.

Cross-reference zizmor SARIF if present. Findings tagged
`category: deployment`, `owasp_ids: ["ASVS-V14.1", "API8:2023"]`.

## 6.9 — ASVS 4.0.3 Level 2 spine

Invoke the **active harness's general-purpose sub-agent primitive** once per
ASVS L2 category (V1 through V17, 17 sub-agents), using the adapter in
`workflow.md §5`. For each category, the invocation has:
- `description`: a short label like `"ASVS L2 V6 (Crypto)"`.
- the host-specific general-purpose selector from `workflow.md §5`.
- `prompt`: the ASVS L2 spec for that category (curated subset in
  `lib/asvs-l2.md`) plus a category-specific file seed
  (e.g. V6 Crypto → `lib/crypto-imports.md`).

Concurrency cap: 8 in flight (same window-dispatch procedure as Phase 5 §5.2
Step B). Use the harness's high-capability general-purpose model without
hardcoding a provider-specific model ID. Do NOT collapse the 17 categories
into a single summary pass, each sub-agent is doing targeted file inspection
against its category's required controls.

Each sub-agent appends JSONL rows to its own per-category file at
`.claude-audit/current/phase-06-asvs-<cat>.jsonl`. After all 17 return,
the orchestrator concatenates them into the canonical aggregate via
this **literal Bash command** (with a count check so a partial fan-out
fails loudly instead of producing a partial aggregate):

```bash
count=$(ls .claude-audit/current/phase-06-asvs-*.jsonl 2>/dev/null | wc -l)
if [ "$count" -ne 17 ]; then
  echo "ERROR: expected 17 ASVS per-category files, got $count — sub-agents failed or were not all dispatched" >&2
  exit 1
fi
cat .claude-audit/current/phase-06-asvs-*.jsonl \
  > .claude-audit/current/phase-06-asvs.jsonl
```

The `ls | wc -l` count is robust under both `nullglob` ON and OFF
(unlike a `set -- glob` test). Run via the Bash tool — do NOT re-write
the rows by reading them into context. Both the per-category files and
the concatenated aggregate are required outputs (see `manifest.yaml`).

Row shape (one JSON object per line):
```json
{"asvs_id":"V6.2.1","status":"PASS|FAIL|N/A","file":"...","line":0,"message":"...","severity":"..."}
```

Compute coverage percentage for the report at the end.

## 6.10 — API Top 10 (2023) mechanical mapping

For each HTTP/gRPC/GraphQL surface in Phase 2:
- API1 (BOLA) — cat-02 findings
- API2 (Broken Auth) — cat-01 findings
- API3 (BOPLA) — cat-02 mass-assignment rows
- API4 (Unrestricted Resource Consumption) — cat-09 (for LLM) + cat-01
  rate-limiting
- API5 (BFLA) — cat-01 admin-role findings
- API6 (Unrestricted Business Flow Access) — out-of-scope for automated
  detection; note as manual review item in report
- API7 (SSRF) — cat-08 SSRF findings
- API8 (Security Misconfiguration) — §6.1-6.8 above
- API9 (Improper Inventory Management) — out-of-scope (manual)
- API10 (Unsafe Consumption of APIs) — outbound_tls surfaces + cat-04

Emit `phase-06-api-top10.jsonl` with one line per API-* category
containing counts and pointers into the underlying findings.

## 6.11 — LLM Top 10 (2025) — conditional

If `profile.llm_usage.detected == false` or `kind == "internal"`,
write an empty `.claude-audit/current/phase-06-llm-top10.jsonl` (zero
bytes) — the empty file is the signal that the gate ran; do not omit it.

Otherwise, ALL cat-09 findings get aggregated here with additional
context mapping (system-prompt sources, tool-calling scope).

## 6.12 — LINDDUN — conditional

If `profile.pii.detected == false`, write an empty
`.claude-audit/current/phase-06-linddun.jsonl` (literally zero bytes)
and note the skip in the methodology coverage. The empty file is the
signal that the gate ran; do not omit the file.

If PII *is* detected, invoke the harness sub-agent primitive once per
`(entity, threat)` pair, where threat is one of: Linkability,
Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness,
Non-compliance. Each sub-agent invocation has:
- `description`: a short label like `"LINDDUN Disclosure on User"`.
- the host-specific general-purpose selector from `workflow.md §5`.
- `prompt`: the LINDDUN threat definition for that threat plus the
  scope of `entity.pii_cols`.

Each sub-agent appends one JSONL row to
`.claude-audit/current/phase-06-linddun.jsonl` for its `(entity, threat)`
pair. Concurrency cap: 8. Do NOT pass a `model` parameter (per §6.9).

## 6.13 — STRIDE per surface

Invoke the harness sub-agent primitive once per top-N partition. For each `p`
in the top-N partition list, the invocation has:
- `description`: a short label like `"STRIDE table for services-api"`.
- the host-specific general-purpose selector from `workflow.md §5`.
- `prompt`: STRIDE methodology + `phase-02-surface.json` scoped to `p`,
  plus `profile.auth`, `profile.trust_zones`, plus the partition's
  Phase 5 `auth` and `idor` findings.

Each sub-agent writes its partition's Markdown table to
`.claude-audit/current/phase-06-stride/<p.id>.md`. Concurrency cap: 8.
Do NOT pass a `model` parameter (per §6.9). Do NOT summarize all
partitions' STRIDE into a single Markdown blob — the per-partition file
layout is how Phase 7 stitches partitions into the final report.

The STRIDE sub-agent reads:
- `phase-02-surface.json` scoped to the partition
- `profile.auth`, `profile.data_model`, `profile.trust_zones`
- Phase 5 `auth` and `idor` findings for the partition

Output Markdown, not JSONL (STRIDE is inherently tabular-narrative).

## 6.16 — OWASP Top 10:2025 (web) mechanical mapping

**Always runs** (no gate, no sub-agent fan-out) — this is a roll-up from
the CWE tags every finding already carries, mirroring the §6.10 API Top 10
pattern. Drive it off the lookup table in `lib/owasp-web-top10.md` (Part 1).

**Edition.** OWASP Top 10:2025 (web) — final (announced Nov 2025, final
text Jan 2026). Tag form `A##:2025` (e.g. `A03:2025`). The owasp_ids
pattern in `lib/finding-schema.json` already admits `A\d+:\d{4}`.

For each finding collected so far (Phase 5 deep-dives + §6.1-6.13), look
up `properties.cwe` in the `lib/owasp-web-top10.md` Part 1 table and assign
it to the **first** matching `A##:2025` category (A01→A10 order, so the
specific access-control / supply-chain buckets win ties — do not
double-count one finding into two A## categories). Key 2025 changes to
honour in the mapping:
- **SSRF (CWE-918) rolls up to A01** (Broken Access Control), not to A05
  Injection — this is the 2025 fold. Keep the finding's own
  `category: injection`; only the `A##:2025` roll-up changes.
- **A03 Software Supply Chain Failures** (NEW) draws from cat-10 supply-
  chain findings + scanner SBOM/dependency results (osv-scanner, trivy,
  grype). A `category: supply_chain` finding still rolls up to A03.
- **A02 Security Misconfiguration** is the §6.1-6.8 config bucket.
- **A10 Mishandling of Exceptional Conditions** (NEW) draws from §6.4
  error-handling findings.

Append the resolved `A##:2025` id to the finding's `owasp_ids[]` (additive;
never replace existing tags) and emit `phase-06-web-top10.jsonl` with one
row per A01..A10 containing counts and pointers into the underlying
findings. Keep the web Top 10 **and** the API Top 10 (§6.10) — both ship.

Row shape (one JSON object per line):
```json
{"web_top10_id":"A03:2025","name":"Software Supply Chain Failures","count":0,"finding_ids":[]}
```

Emit all 10 rows (A01..A10) even when a category's count is 0, so Phase 7's
coverage matrix can report which categories fired.

## 6.17 — Agentic Applications 2026 coverage lens — conditional

If `profile.mcp_agentic.detected != true`, write an empty
`.claude-audit/current/phase-06-agentic-top10.jsonl` (literally zero bytes)
and note the skip in the methodology coverage. The empty file is the signal
that the gate ran; do not omit it. This gate **mirrors how §6.11 LLM Top 10
is gated on `llm_usage`** — except it keys on `mcp_agentic` (tool-calling /
MCP surface), which is a distinct surface that the LLM gate would wrongly
skip.

If `mcp_agentic.detected == true`, this is a **spine-level coverage view**,
NOT new analysis: `steps/deepdive/cat-11-mcp-agentic.md` already emits
per-finding `ASI##:2026` tags during its fan-out. Here, roll those cat-11
findings up by ASI tag into an ASI01..ASI10 coverage matrix, using the list
in `lib/owasp-agentic-2026.md`. No sub-agent fan-out (cat-11 already did it).

**Edition.** OWASP Top 10 for Agentic Applications 2026 — published
2025-12-09; **complementary to** the LLM Top 10 2025. LLM tags stay
`LLM##:2025`; agentic tags are `ASI##:2026` (e.g. `ASI01:2026`). The
owasp_ids pattern already admits `ASI\d+:\d{4}`.

Emit `phase-06-agentic-top10.jsonl`, one row per ASI01..ASI10:
```json
{"agentic_id":"ASI01:2026","name":"Agent Goal Hijack","count":0,"finding_ids":[]}
```

## 6.18 — NIST SSDF (SP 800-218 v1.1) repo meta-check

Repo-metadata-level assertions (NOT per-finding). Cite **NIST SP 800-218
v1.1 (Feb 2022)** explicitly. Assert presence of:
- (PO/RV) a documented vuln-disclosure / `SECURITY.md`.
- (PS/PW) dependency-pinning + SBOM generation in CI.
- (PS.2) signed releases / build provenance.
- (PW.7 / PW.8) automated SAST + secret-scanning in CI.

**When `profile.llm_usage.detected == true` OR `profile.mcp_agentic.detected
== true`**, ADD the **SP 800-218A** assertions — the *Generative-AI / dual-
use SSDF Community Profile*, **final July 2024** (an extension of 800-218,
not a replacement). These are repo-metadata-level meta-checks relevant to
AI components, reported as a meta-check section (not per-finding):
- training-data provenance documented (source, license, integrity);
- model-artifact integrity (checksums / signatures for shipped weights;
  cross-ref cat-10 / cat-11 model-deserialization findings);
- model-supply-chain documentation (which hubs / base models, pinned
  revisions, `trust_remote_code` posture).

Record the SSDF + (conditional) 800-218A results inside `phase-06-config.json`
under an `ssdf` key; surface them in the Phase 7 report's coverage section.

## 6.19 — Authorized-Egress Reconciliation (the cross-layer / missing-enforcer pass)

**Always runs. This is the pass that catches the control-with-no-enforcer /
confused-deputy / capability-URL class** (the deck-2FA bug) — the class that
per-partition, per-handler deep-dives structurally cannot see, because the
credential's writer and the resource's byte-serving sink live in different
partitions and each looks locally fine. Inputs: the GLOBAL `phase-02-sinks.json`
+ `phase-02-credentials.json` + `phase-02-surface.json` + `phase-00-profile.json`.

### Step 1 — deterministic reconciliation + fail-closed coverage gate

Load `SKILL_DIR=$(cat .claude-audit/.skill-dir)` and run:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/validate-egress.py" \
  .claude-audit/current/phase-02-sinks.json \
  .claude-audit/current/phase-02-credentials.json \
  .claude-audit/current/phase-02-surface.json \
  .claude-audit/current/phase-00-profile.json \
  --source-root . \
  --partition global \
  --out .claude-audit/current/phase-06-egress.jsonl \
  || { echo "phase-06 §6.19 FAILED (coverage gate or HIGH+ deficit) — resolve before advancing" >&2; exit 1; }
```

The script (a) re-extracts egress candidates from source and **FAILS the run if
any candidate sink/credential site was neither inventoried nor dismissed in
Phase 2** (fail-closed coverage, **line-scoped** — a sink at one line cannot mask
an un-inventoried sink elsewhere in the same file), and (b) emits one finding per
gate-deficit via rules R2-R5:

- **R2** — R served by ≥2 sinks with differing min-branch gates ⇒ the weaker is a deficit (CWE-862).
- **R3** — a byte-serving branch that is ungated / gated only by "identifier known" on a sensitive R (CWE-639/441).
- **R4** — a credential minted (writers≠∅) but with **zero readers anywhere** — pure theatre (CWE-862). (Reader-based, NOT substring — a credential consumed in middleware is correctly NOT flagged.)
- **R5** — R's strongest gate sits only on a resolve/identify surface (not a byte sink) ⇒ flag every byte-serving sink for R (CWE-862). **This is the deck-2FA rule.**

> **How gates are ranked (controlled, negation-aware).** `enforced_gate` /
> `intended_gate` free text is ranked NONE < AUTHN < AUTHZ < VERIFIED by keyword,
> but **negation dominates**: a description of an *absent* control ("no role
> check", "unauthenticated", "missing ownership") ranks NONE even though it
> contains positive keywords. Unrecognized text also ranks NONE. The failure
> direction is deliberately conservative — an ambiguous gate is treated as **no
> gate**, so the tool over-flags (triaged) rather than misses. A credential that
> protects R raises R's gate floor, so an ungated byte path to R is caught as a
> deficit (R5/R2) — this replaces the unsound v2.4-draft "R1" substring-
> consumption check, which false-positived on credentials enforced in middleware.

If the coverage gate fails, go back to Phase 2 §2.11 and account for the missing
candidates; do not proceed with an incomplete egress inventory. If
`phase-02-sinks.json` has no sinks, write a zero-byte `phase-06-egress.jsonl`.

### Step 2 — adversarial confirmation (attack, don't summarize)

For each deficit finding the reconciliation emitted, invoke the harness
sub-agent primitive
(concurrency cap 8) per `(resource, sink)` with a task that is an **attack, not a
review** — this operationalizes RCA §11 ("show me the request that should
fail"):

- `description`: `"Egress probe: <resource> via <sink_id>"`.
- the host-specific general-purpose selector from `workflow.md §5`; use its
  high-capability default.
- `prompt`: *"Here is a candidate unauthorized-access path: sink `<sink_file>`
  branch `<branch_id>` serves `<resource>` bytes with gate `<enforced_gate>`,
  while the resource's intended gate is `<floor_src>`. **Construct the exact
  unauthenticated / under-authorized request that returns `<resource>`'s bytes,
  or prove it is impossible** by tracing the real middleware/branch order from
  entry to bytes. Read the actual handler + every middleware in its chain — do
  NOT trust the inventory's summary. Return the `verification_probe` (the curl an
  attacker runs + the expected denial), set `actual` if you can statically
  determine the live result, and set **`attacked`**: `confirmed` if you produced
  a concrete bypass request, `refuted` if you proved the gate holds on every
  path, `partial` if part held and part did not. **A `refuted` verdict MUST also
  carry `refutation_scope`** — the boundary of what you actually read (the
  module, the file set, or the call-graph depth). A refutation may only be
  scoped to what was examined."*

Merge each confirmation back into `phase-06-egress.jsonl`: set `attacked`
accordingly and attach the `verification_probe` when the sub-agent constructs a
bypass; **demote/drop** the finding (record as INFO with the refuting line and
its `refutation_scope`) when it proves the gate holds. This adversarial pass is
what turns "the inventory says weak" into "here is the request that proves it".

> **v2.6 — two corrections to how this pass's output is read.**
>
> 1. **It sets `attacked`, not `confidence`.** In v2.5 this pass wrote a
>    run-level `verification_status` that appeared nowhere in the skill, and
>    because §6.19/§6.20 were the *only* steps that produced it, the label
>    silently recorded **which phase emitted a finding** rather than how
>    trustworthy it was. Measured against ground truth: findings marked
>    `CONFIRMED` were **9.6%** true; findings carrying no label — the deep-dive
>    population, which this pass structurally cannot reach — were **92.1%** true.
>    A reader who rationally trusted the label was wrong roughly 10:1. Never
>    present a finding attacked here in the same severity band as an
>    unattacked judgement finding.
> 2. **A wrong refutation is more dangerous than a false positive.** A false
>    positive costs a triager minutes and is self-correcting — they read the code
>    and move on. A wrong refutation files a real HIGH under a heading the reader
>    is told to trust and *stops* them reading the code; nothing downstream
>    reopens it. In the calibrated run, a refutation true of one module was
>    generalised to a system property and buried a live HIGH in which two call
>    sites handed a signing key to a function that set `Authorization: Bearer`.
>    When the finding alleges *credential X reaches sink Y* and the sub-agent
>    refutes it by reading X's producer, **require a caller enumeration of the
>    accessor before accepting the refutation.**

> Honest framing (carries into the report): a clean §6.19 means every *known*
> egress candidate was accounted for and gated — it is high-signal but **NOT a
> proof of absence**. CDN-edge egress with no code path, and any modality outside
> `lib/egress-detection.md`, remain out of mechanical reach and are surfaced as
> report caveats, never silently.

## 6.20 — Collection-Scoping Reconciliation (v2.5)

**Always runs.** §6.19 asks whether every path that emits a resource's *bytes* is
gated. This asks a different question that §6.19 structurally cannot: **does the
query bind rows to the caller?** The handler that motivated this returns JSON, so
it never entered the sink inventory at all; and its gate *is* consumed — just at
the wrong granularity.

### Step 1 — deterministic reconciliation + fail-closed coverage gate

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/validate-collection-scoping.py" \
  .claude-audit/current/phase-02-collections.json \
  .claude-audit/current/phase-00-profile.json \
  .claude-audit/current/phase-02-surface.json \
  --source-root . \
  --partition global \
  --out .claude-audit/current/phase-06-collections.jsonl \
  || { echo "phase-06 §6.20 FAILED (coverage gate or HIGH+ deficit) — resolve before advancing" >&2; exit 1; }
```

The script (a) re-extracts list-query candidates from the handler files and
**FAILS the run if any candidate was neither inventoried nor dismissed** in Phase
2 §2.12 (line-scoped, same discipline as §6.19), and (b) emits one finding per
scoping deficit via rules C1-C6:

- **C1** — a collection of a sensitive entity with no caller-bound predicate,
  no filtering visibility helper, and no `public_resources` entry (CWE-1220).
  `role_restricted` counts as unscoped unless the role is admin-tier.
  **This is the primary rule.**
- **C2** — authorization by decoration: a per-row permission computed and
  attached rather than applied (CWE-863). Write-permission decoration on a
  collection that was never read-filtered is a finding by construction.
- **C3** — `coverage: incomplete|caveat`: a fail-closed deficit, surfaced as an
  open question rather than a silent pass.
- **C4** — a sibling **test** that asserts another principal's row is *present*
  (rather than absent/404), especially with a permission field asserted false.
  High-signal because someone wrote it deliberately: the insecure behaviour is
  encoded as the expected behaviour, so a correct fix will look like a broken
  test.
- **C5** — a `caller_bound`/`visibility_filtered` claim whose `scope_evidence`
  predicate references no session/user/tenant/org value. The row is rewritten to
  `unscoped` and C1 then fires. **The inventory cannot launder a false claim.**

The `|| { ...; exit 1; }` guard is not decoration. Without it the only thing
stopping the run is prose telling the orchestrator to stop, and an orchestrator
that reads a wall of `!` lines and continues anyway turns a "fail-closed" gate
into a suggestion. The shell exit is the part that does not depend on the model
being conscientious.

If the coverage gate fails, return to Phase 2 §2.12 and account for the missing
candidates. Do not proceed on an incomplete inventory.

### Step 2 — adversarial confirmation (attack, don't summarize)

For each C1/C2 deficit, invoke the harness sub-agent primitive (concurrency cap
8) per
`(handler, entity)` with a task that is an attack, not a review:

- `description`: `"Collection probe: <entity> via <handler_file>"`.
- the host-specific general-purpose selector from `workflow.md §5`; use its
  high-capability default.
- `prompt`: *"Handler `<handler_file>` returns a list of `<entity>` and the
  reconciliation says its rows are not bound to the caller (`<row_scope>`,
  gate `<endpoint_gate>`). **Trace the query from construction to response and
  either (a) produce the concrete request that returns another principal's rows,
  or (b) prove every row is scoped** by naming the file:line of the predicate —
  including any base scope, default_scope, tenant-injecting repository, ORM
  client extension, or database row-level-security policy. Read the actual query
  builder; do NOT trust the inventory's summary. Return the
  `verification_probe` (the request an attacker runs + the expected denial) and
  set **`attacked`**: `confirmed` if you produced a cross-principal read,
  `refuted` if you found the scope, `partial` if some rows are bound and some are
  not. **A `refuted` verdict MUST name the `file:line` of the predicate it found
  and carry `refutation_scope`** — a refutation with no line is not a
  refutation."*

Merge each result back into `phase-06-collections.jsonl`: set `attacked` and
attach the probe when the sub-agent constructs a cross-principal read;
**demote to INFO with the refuting line** when it finds the base scope. Missing a
base scope is this rule's main false-positive mode, and this pass is what
retires it.

> **v2.6 — read the note at the end of §6.19 Step 2; it applies here verbatim.**
> This pass sets `attacked`, never `confidence`. The C-rules measured **1.4%**
> true at HIGH+ over a calibrated run, and this pass is the only thing standing
> between that number and the reader — but its own verdicts are not evidence of
> trustworthiness for any finding it never saw.

> Honest framing (carries into the report): a clean §6.20 means every *known*
> list-query candidate was accounted for and scoped. It is high-signal but
> **NOT a proof of absence** — a scope applied by an un-modelled mechanism can
> still be missed in the conservative direction (over-flagging), and a query
> assembled entirely at runtime is recorded as `coverage: caveat`, never as a
> silent pass.

## 6.14 — Emit

Run §6.16-6.20 (web Top 10 roll-up, agentic coverage lens, SSDF meta-check,
Authorized-Egress reconciliation, collection-scoping reconciliation) after the
§6.1-6.13 work, then write all JSONL files (including
`phase-06-web-top10.jsonl`, `phase-06-agentic-top10.jsonl`,
`phase-06-egress.jsonl`, and `phase-06-collections.jsonl`), the STRIDE Markdown
files, and `phase-06-config.json` (the §6.1-6.8 config findings plus the §6.18
`ssdf` meta-check block, in structured form). Write `phase-06.done`.

## 6.15 — Report to user

> Phase 6 complete — ASVS coverage: <X%> passed, <Y%> failed, <Z%> N/A.
> API Top 10 mapping: <count> findings across <N> categories. Web Top
> 10:2025: <K> of 10 categories fired. <LLM/Agentic/LINDDUN status>.
> STRIDE tables written for <K> partitions. Proceeding to Phase 7.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/phase-06-config.json  \
  && test -f .claude-audit/current/phase-06-egress.jsonl \
  && test -f .claude-audit/current/phase-06-collections.jsonl \
  && test -f .claude-audit/current/phase-06.done \
  && echo "phase-06 verified" \
  || { echo "phase-06 INCOMPLETE — re-write artifact(s) + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-06 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
