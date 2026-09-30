# Phase 5 — Parallel Deep Dives (12 categories)

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-05-<category>-<partition>.jsonl` for EACH applicable-category × top-N-partition pair. NOT a single consolidated file.
- `.claude-audit/current/phase-05-skipped.json` — ALWAYS written, even if no categories were skipped (`{"skipped": []}`). The file's presence is the signal that filtering ran.
- `.claude-audit/current/phase-05.done` (marker written only after ALL expected JSONLs exist)

🔁 **Sub-agent fan-out is MANDATORY, not optional:**
- For each `(category, partition)` pair where the category's gate condition holds, invoke ONE sub-agent through the harness adapter in `workflow.md §5`, using the prompt template from `templates/subagent-prompt.md`. Concurrency cap: 8 in flight.
- **If you find yourself reasoning "I'll just cover all 12 categories in one synthesis pass to save tokens" — STOP.** Serial single-pass coverage misses deep per-class bugs (alg:none JWT acceptance, 2FA trust gaps, zip-slip, LFI). The E2E regression test in `tests/e2e/` specifically targets these; skipping fan-out regresses the test.
- Categories whose gating condition is false (e.g., `llm` when `profile.llm_usage.detected == false`) are legitimately skipped — record the skip in `phase-05-skipped.json`. The skipped list always exists; if no categories were skipped, write `{"skipped": []}`.

⛔ **DO NOT:**
- Advance to Phase 6 until every applicable `(category × partition)` JSONL exists on disk AND the Verify block prints `phase-05 verified`.
- Collapse categories into a single `phase-05-tokens.json` / `phase-05-findings.json` / similar consolidated shape — those are v1-era and break Phase 7 per-category aggregation + fixture matching.
- Select a lightweight sub-agent model. Phase 5 requires the active harness's
  high-capability general-purpose model (see §5.2).

---

**Goal.** For each top-N partition, run the applicable category-specific
sub-agents (up to 11; gated ones may not fire) in parallel, 8 in flight.
Each sub-agent consumes the Phase 0/1/2/3/4 artifacts and writes
JSONL findings to disk. Only JSON summaries return through tool output.

**Inputs.** All prior-phase artifacts in `.claude-audit/current/`, plus
per-partition scope from `partitions.json` and Phase 2's surface inventory.

**Outputs.**
- `.claude-audit/current/phase-05-<category>-<partition>.jsonl` — one file
  per (category, partition) pair. Each line conforms to `lib/finding-schema.json`.
- `.claude-audit/current/phase-05-<category>-<partition>.done` — saga marker.
- `.claude-audit/current/phase-05.done` — umbrella marker once all (cat, part)
  pairs are finished.

**Execution model.** Up to `partitions.full_depth_count × 11` sub-agents
(fewer when `llm`/`agentic` gates are false).
Concurrency cap: **8 in flight** (see `workflow.md §5`); pairs beyond 8 queue. Partitions over the
500K-token soft ceiling return `needs_recursion`; the orchestrator splits
them and re-fans-out.

---

## 5.1 — Categories

Each deep-dive category lives in its own file under
`steps/deepdive/cat-<NN>-<slug>.md`. All non-gated categories are required for a
full audit unless the user passes `categories: "<subset>"`.

| # | Category | File | Fan-out gate |
|---|---|---|---|
| 1 | Auth & Authz | `cat-01-auth-authz.md` | always |
| 2 | IDOR / BOLA | `cat-02-idor-bola.md` | always |
| 3 | Token / API Key Scope | `cat-03-token-scope.md` | always (gated further inside the category if no token system exists) |
| 4 | MITM / Transport | `cat-04-mitm.md` | always |
| 5 | Cryptography | `cat-05-crypto.md` | always |
| 6 | Secret Sprawl | `cat-06-secret-sprawl.md` | always |
| 7 | Deployment Posture | `cat-07-deployment.md` | always |
| 8 | Injection / SSRF / Deserialization / Prototype-Pollution | `cat-08-injection-ssrf.md` | always |
| 9 | LLM-specific | `cat-09-llm.md` | only if `profile.llm_usage.detected == true` and `kind != "internal"` |
| 10 | Supply Chain & CI/CD Integrity | `cat-10-supply-chain.md` | always |
| 11 | MCP / Agentic | `cat-11-mcp-agentic.md` | only if `profile.mcp_agentic.detected == true` |
| 12 | Collection Scoping (BOLA at list level) | `cat-12-collection-scoping.md` | always |

**12 categories total** (10 always-on, incl. supply_chain and collection_scope;
`llm` and `agentic` are gated). With the concurrency cap of 8, `(category,
partition)` pairs queue into successive waves — the cap bounds in-flight
sub-agents, not total pairs.

> **Why 12 and not "fold it into cat-02".** cat-02's candidate filter requires an
> id-shaped parameter, so a collection route with no params never becomes a
> candidate — its own "list endpoints must filter by scope" invariant was
> unreachable in practice, and an unscoped list endpoint passed a full v2.4 audit
> as a result. A separate category guarantees the attention and makes the
> coverage countable in the Phase-7 matrix, so the next miss is visible rather
> than inferred.

**Cross-cutting lenses.** Files under `steps/deepdive/` named `lens-*.md` are
**not** categories and do not get their own fan-out. They describe a defect
shape that cuts across several categories, and the categories that must apply
them carry an explicit pointer. Today there is one:

| Lens | File | Applied in |
|---|---|---|
| Availability / integrity with no confidentiality component | `lens-availability-integrity.md` | cat-01, cat-02, cat-08, cat-12 |

A lens is not a 13th category because its findings are not a new kind of
access-control failure — they are the *consequence* half of chains whose
first half the existing categories already look for. See §5.14.

## 5.2 — Fan-out procedure

The orchestrator must invoke the **active harness's general-purpose sub-agent
primitive** once per applicable `(category, partition)` pair. This section is
procedural, not a template. Use the adapter in `workflow.md §5`: Claude Code's
Agent tool takes `subagent_type: "general-purpose"`; GitHub Copilot CLI's
task/subagent tool takes `agent_type: "general-purpose"`.

### Step A: compute the pair list

Load `partitions.json` and the category table in §5.1. For every
`p` in `partitions` where `p.depth == "full"`, walk every category `c`
in §5.1. If `c`'s gate passes against `profile`, add `(c, p)` to the
pair list. If the gate fails, record `{"category": c.id, "partition":
p.id, "reason": c.gate_reason}` in a skip list.

**Write the skip list** to `.claude-audit/current/phase-05-skipped.json`
unconditionally. The shape is always an object wrapping an array:
`{"skipped": [<entry>, ...]}`. If nothing was skipped, the array is
empty: `{"skipped": []}`. The file's presence is the signal that
filtering ran; the array length tells consumers whether any gating
was triggered.

### Step B: fan out, concurrency cap 8

For each `(c, p)` in the pair list, invoke the harness sub-agent primitive with:
- `description`: a short label like `"Deep dive auth on services-api"`
  (one line, ≤80 chars).
- the host-specific general-purpose selector from `workflow.md §5`.
- `prompt`: the full prompt body assembled from
  `templates/subagent-prompt.md`, with `{{phase-specific-method-body}}`
  replaced by the contents of the matching `steps/deepdive/cat-NN-<slug>.md`,
  `{{partition}}` replaced by the partition struct from
  `partitions.json`, and `{{skill_dir}}` replaced by the absolute path
  of this skill's directory (so the sub-agent can resolve
  `$SKILL_DIR/lib/validate-findings.py` etc.).

**Concurrency procedure (cap 8):** maintain a window of up to 8
in-flight sub-agent invocations. Emit up to 8 sub-agent tool calls in one
assistant turn; on the next turn, after the in-flight set has shrunk,
dispatch the next pair(s) to refill the window. Do not exceed 8 in
flight. Do not fire all `len(pairs)` sub-agent calls at once.

**Model selection.** Use the harness's high-capability general-purpose default.
Do not hardcode a provider-specific model ID and do not select a lightweight
model. Treat the template's context budgets as upper bounds; split earlier when
the active model has a lower context limit.

### Step C: validate each returned JSONL before marking the pair done

`$SKILL_DIR` was resolved during the workflow's first action and saved
as a bare path to `.claude-audit/.skill-dir`. **Every** Bash invocation
in this step must re-load it because harness shell calls may start fresh
shells, so the variable does not persist across `(c, p)` iterations:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/validate-findings.py" \
    --schema "$SKILL_DIR/lib/finding-schema.json" \
    --cwe-map "$SKILL_DIR/lib/cwe-map.json" \
    --require-capabilities auth,idor,token_scope,collection_scope \
    .claude-audit/current/phase-05-<c.id>-<p.id>.jsonl
```

The v2.6 obligation gates run in the SAME invocation, via
`--require-evidence-discipline`. JSON Schema cannot express "required only at
HIGH+" or "required only on a refutation", so the validator checks them
imperatively:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/validate-findings.py" \
    --schema "$SKILL_DIR/lib/finding-schema.json" \
    --cwe-map "$SKILL_DIR/lib/cwe-map.json" \
    --require-capabilities auth,idor,token_scope,collection_scope \
    --require-evidence-discipline \
    .claude-audit/current/phase-05-<c.id>-<p.id>.jsonl
```

`--require-evidence-discipline` refuses: a HIGH+ row with no `sibling_sites`,
or with `sibling_sites` and no `sibling_pattern` (an empty array is a CLAIM and
is fine; a missing pattern is an omission wearing a claim's clothes); a
`refuted` row with no `refutation_scope`; a `suggested_fix` with no
`fix_confidence`, or a `verified` one with no cited `file:line`; a non-`reachable`
`deployment_reachability` with no cite; and an `annexed_to` pointing at a parent
that is not in the corpus, or set on a row that is not `heuristic_inventory`.

> **Why the validator and not a `jq` gate.** Earlier drafts of this step used
> three `jq` one-liners. They covered three of the six checks, could not see
> the annex exemption, and — being a second implementation of the same rule —
> were free to drift from the schema they were enforcing. One enforcer, one
> place, exercised by `tests/test-evidence-discipline.sh` in CI.

On exit 0, write
`.claude-audit/current/phase-05-<c.id>-<p.id>.done`.
On exit != 0, re-invoke the Agent with the validator's errors quoted back
into the prompt. After the retry, if it still fails, record one placeholder INFO
finding documenting the errors and proceed.

Re-derive `sibling_sweeps_run` from the file rather than trusting the
sub-agent's RETURN SHAPE. A count is cheap to assert and expensive to earn;
where they disagree, the file wins.

### Step D: write the umbrella marker

Only after every `(c, p)` pair has a matching `.done` file (or
placeholder INFO on double-failure), write
`.claude-audit/current/phase-05.done`.

Partitions with `p.depth == "inventory-only"` are **not** deep-dived.
Their Phase 2 surface rows still appear in the Phase 7 report, but they
receive no finding sub-agents.

### Anti-pattern seen in earlier runs

A single-shot orchestrator can be tempted to reason "I'll just walk
through all 12 categories serially in one head-space and write a single
consolidated JSON." **That pattern missed alg:none JWT acceptance,
2FA trust gaps, zip-slip, and LFI** in v2.0.1's E2E iteration runs —
all four are bugs that require category-specific deep attention which
only per-sub-agent invocation provides. If you reach for the shortcut,
stop and fan out.

## 5.3 — Finding schema (enforced on every sub-agent)

Each `.jsonl` line conforms to `lib/finding-schema.json`. Sub-agents MUST
populate:
- `id`, `severity`, `confidence`, `category`, `partition`, `file`, `line`
- `evidence_class` — for a Phase-5 sub-agent this is **always**
  `agent_judgement`. Cross-referencing a Phase-4 SARIF row adds a `scanner`
  entry to `sources[]`; it does **not** make the row `external_scanner`.
- `cwe` — look up in `lib/cwe-map.json`; fall back to `CWE-1007` only if
  absolutely no better mapping exists
- `owasp_ids[]` — see §5.4 below
- `title` (≤120 chars), `description` (≤800 chars)
- `sources[]` — at least one source (grep, scanner, manual, or subagent)

Conditionally required (enforced by the §5.2 Step C gates, not by the schema):
- `sibling_pattern` + `sibling_sites[]` on every **HIGH+** row (§5.9)
- `refutation_scope` on every row with `attacked: "refuted"` (§5.10)
- `fix_confidence` on every row carrying a `suggested_fix` (§5.11)

Strongly encouraged: `suggested_fix`, `attack_scenario`, `surface_id`,
`remediation_effort`, `fingerprint` (stable across title drift; see
`phase-07-synthesis.md §7.2`).

**Capability tagging — REQUIRED for `auth`, `idor`, `token_scope`, and
`collection_scope`** (v2.5). Every finding in those categories must carry
`preconditions[]` and a **non-empty** `postconditions[]` in the
[`lib/capability-lexicon.md`](../lib/capability-lexicon.md) grammar. Validate
with `--require-capabilities auth,idor,token_scope,collection_scope`.

This is not bookkeeping. `preconditions` is where the prose mitigation goes: if
you are about to write *"only exploitable if the attacker knows the UUID"*, write
`preconditions: ["knows:any_<entity>_id"]` instead. The Phase-7 gate then checks
whether another finding in this same report **supplies** that capability — and if
it does, the mitigation is undischarged and cannot lower the severity. That
exact sentence, left in prose, cost 96 days of exposure on a CONFIRMED finding.

**Enforcement.** Every sub-agent MUST run the schema validator before
emitting its RETURN SHAPE.

**The bash block below is what the SUB-AGENT runs, NOT what the
orchestrator runs.** The orchestrator's own validation pass is in
§5.2 Step C and uses `$SKILL_DIR` from `.claude-audit/.skill-dir`.
For the sub-agent, the orchestrator substitutes the literal absolute
path into the prompt (per §5.2 Step B) before the prompt reaches the
sub-agent. The placeholder shown here as `<absolute-path-to-skill>`
will arrive at the sub-agent as a real path like
`/home/user/.copilot/skills/security-audit`. **Do not emit this block
directly to your Bash tool** — it is illustrative of the sub-agent's
view, not a command for you to run:

```bash
# AS SEEN BY THE SUB-AGENT (orchestrator-side substitution already done):
python3 "<absolute-path-to-skill>/lib/validate-findings.py" \
    --schema "<absolute-path-to-skill>/lib/finding-schema.json" \
    --cwe-map "<absolute-path-to-skill>/lib/cwe-map.json" \
    --require-evidence-discipline \
    .claude-audit/current/phase-05-<cat>-<partition>.jsonl
```

Exit 0 is required to proceed. On non-zero exit, the sub-agent fixes
every reported issue and re-validates. The orchestrator's first
post-sub-agent step is a second invocation of the validator — if the
sub-agent skipped it or lied about passing, the orchestrator catches
it and retries the sub-agent once. Second failure records a placeholder
INFO-level finding and moves on.

## 5.4 — OWASP tagging

Every finding gets at least one OWASP identifier:
- **ASVS 4.0.3** category id, e.g., `ASVS-V6.2.1` (the edition
  `lib/asvs-l2.md` enumerates; 5.0.0 renumbered every chapter, so mixing
  editions produces tags that resolve to the wrong control)
- **API Top 10 (2023)**: `API1:2023` … `API10:2023`
- **LLM Top 10 (2025)**: `LLM01:2025` … `LLM10:2025`
- **Web Top 10 (2025)**: `A01:2025` … `A10:2025` (cat-08/10 and the §6.16 roll-up)
- **Agentic Apps (2026)**: `ASI01:2026` … `ASI10:2026` (cat-11 and the §6.17 lens)

All five forms are accepted by `lib/finding-schema.json`. Category-specific
mapping guidance lives inside each `cat-<NN>` file.

## 5.5 — Confidence calibration

`confidence` answers *how likely is this true*. It is **not** a provenance
marker and **not** a verification marker — those are `evidence_class` and
`attacked`, and conflating the three is the defect v2.6 exists to fix.
Measured over a calibrated run of v2.5.0: rows labelled `CONFIRMED` were
**9.6%** true and rows carrying no label at all were **92.1%** true, because
only phase-06 ever set the field, so it silently recorded *which phase
emitted the row*. Do not re-create that.

- **CONFIRMED** — finding verified by ≥2 independent sources (e.g., a
  grep pattern AND a scanner rule, or surface-row flag AND handler-body
  inspection).
- **LIKELY** — one strong source (scanner with high specificity, or a
  textually unambiguous grep match).
- **POSSIBLE** — single grep hit with ambiguity (e.g., `eval()` that might
  be on user-controlled input or might not — needs Phase 7 cross-reference).

**Refutations calibrate one rung lower** — see §5.10. A negative claim over
a surface is not established by the same evidence that establishes a
positive claim about one line.

## 5.6 — Cross-referencing scanner findings

When a sub-agent's own grep hits overlap with a Phase 4 slim-SARIF finding
(same file + similar line), the finding receives BOTH a `grep` source and a
`scanner` source. Confidence automatically becomes `CONFIRMED`. Slim SARIF
files to consult: `phase-04-scanners/*.slim.json`.

**`evidence_class` does not move.** A Phase-5 row stays `agent_judgement`
even when a scanner agrees with it — the scanner's agreement is recorded in
`sources[]`, which is what §7.4 reads. Promoting the row's evidence class
because a second source appeared is the exact category error that let the
19.8%- and 1.4%-true rule families call themselves mechanical ground truth.

## 5.7 — Determining recursion

A sub-agent that realizes its scoped partition exceeds 500K raw code
tokens MUST return (stdout, JSON):

```json
{
  "status": "needs_recursion",
  "reason": "partition too large: ~720K raw tokens across 4 sub-modules",
  "suggested_split": [
    {"id": "p-subA", "paths_included": ["services/api/users/**"]},
    {"id": "p-subB", "paths_included": ["services/api/orders/**"]}
  ]
}
```

The orchestrator reads the `suggested_split`, creates the sub-partitions,
and re-fans-out.

## 5.8 — Error / timeout handling

- Sub-agent stdout not JSON → retry once with a corrected prompt; second
  failure produces a placeholder INFO-level finding and moves on.
- Sub-agent hangs → orchestrator's 80-turn budget expires; record timeout.
- Sub-agent returns empty findings → valid; record as `findings_count: 0`.

## 5.9 — The sibling sweep (MANDATORY on every HIGH+ finding)

**The tool finds instances. The report needs classes.** This section is the
single highest-value obligation in v2.6 and it is one grep per finding.

Every finding that survives to HIGH or CRITICAL derives its defect's shape as
a mechanical pattern, runs that pattern repo-wide, and reports the full site
list — **or states explicitly that the cited site is the only one.**

**Procedure** (the sub-agent runs it; `templates/subagent-prompt.md` carries
the operative wording):

1. **Reduce the defect to a shape.** Not the sentence describing it — the
   literal text that distinguishes it. `postgres(` with no adjacent `ssl`
   option. `'admin'` inside a policy `USING` clause. `uses: owner/action@v4`.
   `? 'https' : 'http'`. If you cannot write the shape, you have not
   understood the defect well enough to file it HIGH.
2. **Self-check the pattern against your own finding.** If it does not match
   the `file:line` you are filing, the pattern is wrong. This single check
   catches most bad sweeps before they produce a bad site list.
3. **Run it repo-wide**, honouring `.claude-audit/ignore.txt`. The partition
   boundary bounds *analysis*, not *enumeration* — a defect class does not
   stop at a partition edge. The sub-agent prompt carries the explicit
   carve-out from the SCOPE rule.
4. **Record `sibling_pattern` verbatim and every other hit in
   `sibling_sites[]`.** Confirm each hit is the same defect and not merely
   the same string; a hit you dismiss gets a `note` saying why. It does not
   get deleted.
5. **Truncate loudly.** Over 50 sites: record the first 50 and put the true
   total in `notes`.

`"sibling_sites": []` is a **positive claim** — *"the cited site is the only
one in the repository"* — admissible only with `sibling_pattern` present. An
empty array with no pattern is an omission wearing a claim's clothes, and the
§5.2 Step C gate rejects it.

> **The incident.** Of 34 defects the triage found and the audit missed, the
> majority were the second, third and fourth site of a defect the audit had
> correctly found **once**:
>
> | Defect class | Audit filed | Actual surface |
> |---|---:|---:|
> | Region-root placement writers | 2 | 4 |
> | `postgres()` with no `ssl` option | 4 ("all four call sites") | 10 |
> | Mutable GitHub Action tags | 4 | 10 of 12 |
> | `'admin'` in the RLS region bypass | 1 policy (and misnamed) | **25 clauses across 10 migrations** |
> | Plain-HTTP downgrade (`? https : http`) | 1 | 7 |
>
> Each of those counts is a one-line grep. A mechanical sweep does not get
> bored at nine. Both the tool and eight security engineers did.

**Honest scope.** The sweep is grep-shaped: it catches classes expressible as
a pattern. A defect whose siblings differ *structurally* — the same bug
written three different ways — remains an agent-diligence problem and this
rule does not solve it. It solves the case that actually happened.

## 5.10 — Scope every refutation

**A false positive is self-correcting. A wrong refutation is not.** A false
positive costs a triager minutes and dies when they read the code. A wrong
refutation files a real defect under a heading the reader is told to trust,
*stops* them reading the code, and nothing downstream reopens it. This is the
most dangerous class the calibration found.

A **refutation** is any claim that an alleged defect does NOT hold: a
candidate dismissed, a control asserted sufficient, a severity lowered
because "X already handles it", or anything destined for the report's
**"What is sound"** table.

**Channel.** A refutation is filed as a finding row with:

```jsonc
{
  "severity": "INFO",
  "category": "methodology",          // NOT the host category — see below
  "evidence_class": "agent_judgement",
  "attacked": "refuted",
  "refutation_scope": "<the boundary, and the command that established it>",
  "notes": "refutes: <what was alleged>; host category: <auth|idor|…>"
  // postconditions deliberately absent — a refutation grants nothing
}
```

That is the only channel. A refutation left in prose reaches the report
unbounded — which is precisely how the incident below happened.

> **Why `methodology` and not the host category.** `--require-capabilities`
> demands a **non-empty** `postconditions` on every `auth` / `idor` /
> `token_scope` / `collection_scope` row, on the correct principle that *a
> finding that grants the attacker nothing is not a finding*. A refutation
> grants nothing by definition. Tagging it with the capability the alleged
> defect *would* have granted would feed a **disproven** capability into the
> composition graph and escalate its neighbours — the exact failure mode v2.6
> exists to remove. So the row carries `methodology` and names its host
> category in `notes`, and the report groups the "What is sound" table by that
> note.

**`refutation_scope`** states the boundary of what was actually examined: the
module, the file set, the call-graph depth, and the command that established
it. **The refutation may not assert one inch beyond that boundary.** A row
whose scope is a single module may not make a system-level assertion.

Distrust your own sentence when it contains *never*, *only*, *no caller*, or
*always*. Those quantify over a call graph, and a call graph is enumerated,
not intuited.

**The mechanical check — not optional.** When a finding alleges *credential X
reaches sink Y*, and an analyst refutes it by reading **X's producer** (the
accessor, getter, factory or provider that returns X), the refutation is not
accepted until a **caller enumeration of the accessor** has been run, with
the command and the caller count recorded in `refutation_scope`. Reading the
producer establishes what it *returns*. It establishes nothing about where
the return value *goes*.

**Confidence.** A refutation is filed one rung below what the same evidence
would earn as a finding, and never `CONFIRMED` off a single-module read.

> **The incident (E1).** A refutation true of ONE module — *"the key never
> leaves the module"* — was generalised to a system property and printed in
> the "What is sound" table. Two call sites hand a GitHub App signing key to
> a function that sets `Authorization: Bearer ${pat}`. That real HIGH was
> buried under the one heading in the report the reader is told to trust.

## 5.11 — `fix_confidence` — the fix is what gets executed

The finding and the fix are two claims and they get two ratings. Today the
fix inherits the finding's credibility for free, and the calibration shows
that is not warranted.

Every finding carrying a `suggested_fix` carries `fix_confidence`:

| value | bar |
|---|---|
| `verified` | You opened the **actual dependency / driver / API being asserted about** and can cite `path:line` in it — the installed source under `node_modules/`, `vendor/`, `site-packages/`, or the pinned version's published source. Put the cite **in** the `suggested_fix` text. |
| `inferred` | The fix follows from documentation or from how the rest of the repo does it, but the implementation was not read. |
| `untested` | A change whose behaviour has not been established at all. |

A recollection of a library is not a cite. If it was not opened, it is
`inferred`.

**Prefer the smallest fix the cite proves**, and do not merge two candidate
fixes for one defect into one paragraph. If two are in play, file the one
that can be cited and name the alternative in `notes`.

> **The incident (E2).** Six findings on ONE Postgres-TLS defect. The
> **finding was right on all six.** The **fix was wrong on five** — they
> prescribed a nine-site `ssl: { rejectUnauthorized … }` change plus a
> CA-bundling exercise that was unnecessary. The sixth prescribed a one-word
> `?sslmode=verify-full` substitution and cited the driver source proving it
> (`cjs/src/connection.js:283-285`). The correct fix was in the minority and
> the report merged the wrong text into its priority list.

**Synthesis-side companion.** Two findings on the same defect with the same
CWE whose `suggested_fix` texts disagree are flagged for reconciliation
rather than shipped as two items — see `phase-07-synthesis.md`.

## 5.12 — A subsystem-wide fix is a claim about every member

`"Add X across path/**"` — or across a directory, a route group, a middleware
chain, or "all handlers that …" — is a claim about **every member of that
set** and carries a finding's evidence bar.

It is not emittable without an **enumerated member list**: each member named,
and for each one the specific thing the fix would clamp. A member whose clamp
cannot be named is a member the fix does not apply to — say so and exclude it
explicitly. Put the enumeration in `sibling_sites[]` (§5.9 already made you
run the sweep; this is the same list, read as a remediation surface).

> **The incident (E3).** The report advised *"add `requireRegionScope` across
> `admin/reconciliation/**`"*. **11 of 16 handlers had nothing to clamp** —
> the pivotal table has no region column — so the change would either no-op
> or deny every region admin. Separately, the exemption list had one
> backwards: an unclamped cross-region hard `DELETE` on a table that *does*
> carry the column.

## 5.13 — Design-record deference

An **asymmetry finding** is shaped *"path A is clamped and path B is not"*,
*"this validates and that does not"*, *"the check is here but not there"*.
Before filing one, read `design_records[]` in `phase-00-profile.json` (§0.15)
and look for a ratified decision covering it.

**When a decision record ratifies the asymmetry and names a compensating
control, the burden shifts.** To file the asymmetry itself you must **rebut
the record**: locate the named control, show that it does not exist, does not
hold, or does not cover this path, cite it at `file:line`, and put the
rebuttal in the description with the record's path in `notes`.

Without a rebuttal you may still file the **narrow defect you can evidence**.
You may not file the asymmetry as the finding.

Then check the other direction: **would the fix even fire?** If the arm you
propose to add is already a tautology at that site, or is unreachable, the
remediation is a no-op and the finding is not what you think it is.

> **The incident (E4).** The report filed a deliberate, documented asymmetry
> as its Theme 4, writing *"The asymmetry **is** the finding"* — while the
> project's own ratified decision record named the compensating control, and
> an independent review confirmed the clamps were real and one policy arm was
> a tautology that could never deny. A narrow defect survived triage. The
> theme as filed did not, and acting on its remediation would have added a
> call that cannot fire, against the design record.

**The sentence *"the asymmetry is the finding"* is precisely the one to be
suspicious of when a decision record exists.** If you catch yourself writing
it, go and read the record.

## 5.14 — Availability / integrity attack paths (cross-cutting lens)

Every category above is oriented toward **confidentiality** — who can read
what. A whole class of attack path has no confidentiality component at all
and therefore matches nothing in the catalogue. It is not a 13th category; it
is a lens applied inside the categories that already run.

Read [`deepdive/lens-availability-integrity.md`](deepdive/lens-availability-integrity.md)
and apply it in **cat-01 (auth/authz)**, **cat-02 (IDOR/BOLA)**,
**cat-08 (injection/SSRF)** and **cat-12 (collection scoping)**. Those four
files each carry a pointer to it.

> **The incident.** The calibrated run missed a HIGH in which an uncapped
> provisioning call lets a *developer* mint more than 500 empty instances,
> displacing every real one from a downstream **fixed-size 500-row scan** —
> producing an estate-wide **silent attribution stop**. Nothing is disclosed.
> Nothing errors. The data simply stops being correct, and no rule in the set
> looks for that shape.

## 5.15 — Report to user

After all (category, partition) combinations finish:

> Phase 5 complete — <total> findings across <N> partitions × <11 - gated>
> categories. Breakdown: <count> CRITICAL, <count> HIGH, ... Sibling sweeps
> run: <count>/<HIGH+ count>. Refutations filed: <count>. Proceeding to
> Phase 6 (Config + Methodology Spine).

Never echo finding contents to the user in the phase report. Full content
is in the JSONL files; Phase 7 synthesis is the user-facing consolidation.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/phase-05-*.jsonl # (at least one per non-gated category) \
  && test -f .claude-audit/current/phase-05.done \
  && echo "phase-05 verified" \
  || { echo "phase-05 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-05 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
