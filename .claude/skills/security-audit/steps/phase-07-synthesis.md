# Phase 7 — Synthesis & Report

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-07-report.md` (full structured human-readable report)
- `.claude-audit/current/findings.sarif` (SARIF 2.1.0 — see ⚠ below for per-result requirements)
- `.claude-audit/current/findings.cyclonedx.json` (SBOM, minimal skeleton if no scanner SBOM available)
- `.claude-audit/current/phase-07-findings-computed.jsonl` (§7.15 — findings with `severity_computed` applied; AUTHORITATIVE input to the report and SARIF)
- `.claude-audit/current/phase-07-governance.jsonl` (§7.15 — R4/L1-L3 governance findings; empty file if clean)
- `.claude-audit/current/phase-07-severity-gate.json` (§7.15 — gate summary incl. `blocking`, read by Phase 8)
- `.claude-audit/current/phase-07.done`

⚠ **EVERY `results[]` row in the synthetic `security-audit-skill` SARIF run MUST carry these properties:**
- `properties.security-severity`: CVSS-style numeric string. CRITICAL→`"9.0"`, HIGH→`"7.0"`, MEDIUM→`"5.0"`, LOW→`"3.0"`, INFO→`"1.0"`. Required for the GitHub Security tab.
- `properties.cwe`: the CWE id as a string (e.g. `"CWE-798"`). Required for fixture matching, baseline delta, and GitHub Security tab grouping. Look up the CWE in `lib/cwe-map.json`; if absent, use your best judgement and add an entry in a follow-up.
- `properties.category` (recommended): one of `auth`, `idor`, `token_scope`, `collection_scope`, `mitm`, `crypto`, `secret_sprawl`, `deployment`, `injection`, `llm`, `supply_chain`, `agentic`, `config`.

Per-scanner SARIF runs are copied through verbatim **with one exception,
and the exception is not optional**: they must already have been through
`phase-04-scanners.md §4.4b`, which strips credential material at ingest.
"Verbatim" here means *do not rewrite scanner findings to normalise their
metadata* — scanner CWE lives in `tags[]` / `rule.properties.tags` / driver
relationships per the scanner's own conventions (§7.8), and rewriting it loses
information. It has never meant "copy raw secrets into the deliverable", though
through v2.6.0 that is exactly what it caused. See §7.8.1 and §7.10.

⛔ **DO NOT emit the human report without also emitting findings.sarif with CWE-per-result.** The report is the cover page; SARIF is the machine-readable deliverable. Producing only the report is a regression to v1 and breaks every downstream integration (delta mode, GitHub Security tab upload, CI gating on CRITICAL counts, fixture-based E2E validation).

---

**Goal.** Collect every finding from Phases 1-6, deduplicate, cross-
reference sources, assign final severity, identify skill-unique findings,
and emit three consumable artifacts: a human Markdown report, a
consolidated SARIF 2.1.0 document, and a CycloneDX SBOM.

**Inputs.**
- `phase-04-scanners/*.slim.json` (all scanner output)
- `phase-04-scanners/security-review-*.md`
- `phase-04-scanners/adversarial-*.md`
- `phase-05-*.jsonl` (all deep-dive category findings)
- `phase-06-config.json`, `phase-06-asvs.jsonl`, etc.
- `phase-06-egress.jsonl` (Authorized-Egress reconciliation findings, §6.19)
- `phase-06-collections.jsonl` (collection-scoping reconciliation findings, §6.20)
- `phase-02-sinks.json`, `phase-02-credentials.json` (egress inventories, for the report's coverage counts)
- `phase-02-collections.json` (collection inventory, for the report's row-scope counts)
- `phase-00-profile.json`, `partitions.json`, `phase-02-surface.json`

**Outputs.**
- `.claude-audit/current/phase-07-report.md` — the full, structured report.
- `.claude-audit/current/findings.sarif` — SARIF 2.1.0 consolidated.
- `.claude-audit/current/findings.cyclonedx.json` — SBOM (from trivy
  output if present; otherwise produced by syft if installed).
- Deliverable copies under the resolved `<output_dir>` (default
  `docs/security-audit-output/`, see [../lib/output-routing.md](../lib/output-routing.md)):
  `<output_dir>/security-audit-report.md`, `<output_dir>/findings.sarif`,
  `<output_dir>/findings.cyclonedx.json`. Copy AFTER the blackboard files
  above exist (blackboard-first).
- `.claude-audit/current/phase-07.done`

**Execution.** Single orchestrator pass. No sub-agent fan-out (synthesis
must see the whole picture).

---

## 7.1 — Collect

Load every JSONL / JSON artifact into in-memory lists:
- `findings[]` — all Phase 5 + Phase 6 JSONL lines + scanner-derived
  findings (from slim SARIF, with the scanner tool name in `sources[0].detail`).
  **Include `phase-06-egress.jsonl`** — the Authorized-Egress reconciliation
  findings (cross-layer / missing-enforcer class). These carry
  `sources[].kind = "heuristic"`, `sources[].detail = "validate-egress.py:R<n>"`
  and often a `verification_probe`; preserve the probe through dedup so it
  reaches the SARIF (`properties`) and the report. They are **deterministic but
  not ground truth**: `evidence_class = "heuristic_inventory"`, because the
  rule is mechanical over an inventory a *sub-agent wrote*. v2.5 called this
  class "scanner" and §7.3 handed it CONFIRMED plus a severity rung; measured
  true-positive rate of that family over a calibrated run was **19.8%**. It gets
  no promotion (§7.4) and is annexed rather than filed (§7.2b).
- `asvs_results[]` — Phase 6 ASVS rows.
- `stride_tables{}` — per-partition Markdown blobs.
- `surfaces[]` — Phase 2.
- `profile`, `partitions` — discovery / partition data.

## 7.2 — Deduplicate

### Pass 0 — dedup on `id` FIRST (v2.6, story 4.1)

**Run this before the fingerprint pass.** Two rows carrying the same `id` are
the same finding by definition; nothing further needs to be compared.

The calibrated v2.5.0 run wrote **1361 rows carrying only 1256 distinct ids**.
Seven `config` ids appeared **six times each** (with three distinct payloads
among the six) and the ASVS ids four times each. The §7.2 key below never caught
them because it is `(file, line, category, fingerprint)` and **only 420 of the
1361 rows carried a `fingerprint` at all** — a missing fingerprint made every
row's key distinct. Nine surplus rows landed inside the HIGH+ population, so
**every headline count in that report was overstated**.

For each duplicate `id` group:
- If the payloads are byte-identical, keep one silently.
- If they differ, keep the longest `description`, union `sources[]`,
  `owasp_ids[]`, `sibling_sites[]` and `rules_fired[]`, keep the **higher**
  severity, and **record the collision** in the report's Audit Coverage section.
  Divergent payloads under one id mean two phases minted the same id for
  different things, which is an id-generation bug that will recur next run —
  say so rather than merging it away.

### Pass 1 — dedup on fingerprint

Deduplication key: `(file, line, category, fingerprint)` where
`fingerprint` is the first 12 chars of
`sha1(handler_file:line:cwe:category)`. **Compute the fingerprint when the row
does not carry one** — do not let a missing `fingerprint` make the key unique,
which is the defect above.

**Why keyed on CWE + category, not title** (v2.0.1 correction): the
sub-agent's finding `title` can drift between runs — a re-run that
rephrases "Hard-coded JWT secret" to "Hard-coded RSA private key in
lib/insecurity.ts" produces a different sha1 and the baseline's
carryover misses it. Keying on the CWE + category class makes
fingerprints stable across title drift while keeping file+line
specificity. Two findings at the same file:line with the same CWE are
semantically the same finding regardless of wording.

Two findings with the same key:
- Merge — keep the one with the longest description (most detailed),
  union their `sources[]`, set `confidence` according to §7.3.
- Keep the higher severity.
- Union their `owasp_ids[]`.

**Stability guarantee.** A finding's fingerprint is reproducible given
`(handler_file, line, cwe, category)`. Baseline carryover (Phase 8) and
delta-mode invalidation (M6) both use this fingerprint. If the sub-
agent emits a `fingerprint` field on the JSONL row, Phase 7 uses it
verbatim; otherwise Phase 7 computes it. Either way the canonical
formula is the one above.

## 7.2b — Annex the mechanical families (v2.6, Wave 2b) — MANDATORY, before §7.3

**Runs immediately after dedup and before anything reads a severity.**

The mechanical rule families (`validate-egress.py` R-rules,
`validate-collection-scoping.py` C-rules — every row with
`evidence_class == "heuristic_inventory"`) stop being independent findings and
become the **fix surface** of the judgement finding they sit on.

**The measured fact that decides this.** Of the 17 *true* mechanical findings in
the calibrated run, **15 were restatements of a deep-dive finding on the same
line** — the triage verdict text says so almost verbatim each time. The only
pair with no deep-dive twin was an ACCEPTED_RISK. **The mechanical rules
surfaced no unique CRITICAL.** Any claim that they "found 16 real defects" is
double-counting. Meanwhile they made up **60% of the HIGH+ population** at
**11.0%** precision.

**Why they are not deleted.** They produced the complete fix surface,
mechanically: a deep-dive agent found the credential-exfil *class*; R2/R3/R5
enumerated its **nine distinct legs at exact line granularity**, which no agent
did. Precision is the wrong metric for a rule whose product is a *surface*
rather than a *conclusion*. Deleting them would trade a mechanical guarantee for
an agent's diligence — and 34 defects the triage found and the audit missed are
direct evidence that LLM analysts do not reliably enumerate. (Separately, the
C-rule *concept* has never actually been tested: its 1.4% rate measures a
`_strip_literals` bug, not C1/C5.)

### The join

For each row with `evidence_class == "heuristic_inventory"`:

1. **Join on `(file, line)`** to a row with
   `evidence_class == "agent_judgement"`. Exact line match.
2. **Fall back to `(file, cwe)` within ±40 lines** — same file, same CWE, and
   the nearest judgement row **no more than 40 lines away**; ties break on the
   highest severity. Beyond that window, **do not match — leave the row an
   orphan annex.**

   The window is the whole point of this step. "Same file, same CWE, any line"
   is an unbounded free variable: a file with two distinct CWE-862 defects 400
   lines apart would fold the mechanical row for one into the judgement finding
   for the other purely because it was nearest, corrupting that finding's
   `sibling_sites`, mislabelling its `sibling_pattern`, and silently discarding
   the correct target. An orphan is a visible, low-confidence lead; a
   misattribution is an invisible wrong answer inside a finding a reader trusts.
3. **On a hit** — set `annexed_to = <parent id>`, append
   `{file, line, note}` to the **parent's** `sibling_sites[]`, and set the
   parent's `sibling_pattern` to the annexed row's `rule_family` if the parent
   has none. The annexed row **carries no severity of its own**: it is not
   counted in any severity band, not counted in the executive summary's
   by-severity totals, and gets no `results[]` row of its own in SARIF (§7.8).
4. **On a miss** — the row is an **orphan annex**; see below.

### Orphan annexes — the recall preservation, and it must not be dropped

A mechanical row with **no** judgement twin is the only thing that looked at its
area. On a codebase where no deep-dive covered a partition, the mechanical rule
is the entire coverage of it. So orphans **always surface**, under their own
explicitly-labelled heading:

- Rendered as a **low-confidence lead list**, never as findings.
- **Capped out of the headline severity band**: an orphan annex may not appear
  in the CRITICAL or HIGH sections and does not contribute to the executive
  summary's CRITICAL/HIGH counts, whatever severity the rule asserted. It is a
  lead to be checked, not a rating.
- Labelled with its `rule_family` and the family's last measured true-positive
  rate, so a reader knows what they are looking at.

**A silent drop here is a recall regression and blocks the release** — see
`docs/EPIC-v2.6-calibrated-severity.md` §3.2 for the 17-site recall floor that
must still appear somewhere in the output after this re-cast.

### Step 5 — REQUIRED: validate the annexed corpus

The join above is the only step in this skill that can make a finding stop being
a finding. It runs here, on merged Phase-7 data, so the Phase-5 validation pass
has already happened and **cannot** have checked it — `annexed_to` did not exist
when Phase 5 ran. Re-validate now, or the annex's own safety checks never
execute on a single real annexed row:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
python3 "$SKILL_DIR/lib/validate-findings.py" \
    --schema "$SKILL_DIR/lib/finding-schema.json" \
    --require-evidence-discipline \
    .claude-audit/current/phase-07-findings-annexed.jsonl
```

This refuses an `annexed_to` naming a parent that is not in the corpus (a
dangling parent **deletes** a finding rather than demoting it — nothing carries
its obligations any more) and an `annexed_to` on a row that is not
`heuristic_inventory` (a judgement finding may not fold itself away). Both are
one-field ways to make a real finding disappear, which is why they are checked
mechanically rather than described.

**Non-zero exit blocks the phase.** Fix the join and re-run; do not proceed with
an unvalidated annexed corpus. `compose-attack-paths.py` additionally reports any
`annexed_to` it cannot resolve as a `DANGLING ANNEXES` block and reclassifies
those rows as orphan annexes, so a reference broken by §7.2's id-dedup surfaces
as a lead rather than vanishing.

### Consequence for the severity gate

Annexed rows are **excluded from the capability composition graph entirely**
(§7.15). `compose-attack-paths.py` enforces this — it drops any row carrying
`annexed_to` before reading a single capability, and prints the count. This is
what removes the B3 escalation path at its source rather than by threshold
tuning: **47% of the calibrated run's 1120 capability tags** were minted by the
C-rules with no evidence check, and **53 of 73** HIGH+ C-rule findings ended
CRITICAL while **72 of 73** were false.

## 7.3 — Cross-reference confidence

After dedup and the §7.2b annex pass.

**`confidence` no longer buys severity.** In v2.5 a single `scanner` source
bought CONFIRMED and CONFIRMED bought **+1 rung** (§7.4). Both reconcilers
declared themselves `scanner`, and `validate-egress.py` additionally hardcoded
`"confidence": "CONFIRMED"` on every row **at emission, before anything was
attacked**. So the two least precise families got an automatic promotion.
Measured over a calibrated run: findings labelled CONFIRMED were **9.6%** true;
findings carrying no label at all were **92.1%** true. The label was
anti-correlated with truth because it only ever recorded *which phase emitted
the row*. Severity promotion now keys on `evidence_class` and nothing else
(§7.4); `confidence` is a readable annotation.

- **CONFIRMED** — `sources[].length >= 2` OR a single source of type
  `scanner`, where **`scanner` means a named external tool**: `semgrep`,
  `trivy`, `osv-scanner`, `gitleaks`, `trufflehog`, `hadolint`. The tool's name
  must appear in `sources[].detail`. A source that names one of *this skill's
  own* scripts is **not** a scanner — it is `kind: "heuristic"`, and a
  reconciliation over an inventory a sub-agent wrote is not mechanical ground
  truth however mechanical the reconciler is.
- **LIKELY** — single `grep` source with a specific, unambiguous
  pattern name.
- **POSSIBLE** — single `grep` source with a generic pattern, or
  single `manual` source from `/security-review`, or any single
  `heuristic` source.

The Phase 5 sub-agents already assign an initial `confidence`. Phase 7
may promote (LIKELY → CONFIRMED when another source appears) but never
demote.

### ⛔ `evidence_class` DOES NOT MOVE — ever, in this phase

**Cross-referencing raises `confidence`. It NEVER raises `evidence_class`.**
This is the Phase-7 half of the rule stated for sub-agents in
`phase-05-deepdives.md §5.6`, and it must exist in both places, because
`confidence` is *supposed* to rise when a second source appears and the
temptation to carry the row's class up with it is exactly the mistake.

| Row starts as | A scanner also flags it | `confidence` | `evidence_class` |
|---|---|---|---|
| `agent_judgement` | semgrep agrees | may rise to CONFIRMED | **stays `agent_judgement`** |
| `heuristic_inventory` | semgrep agrees | may rise to CONFIRMED | **stays `heuristic_inventory`** |
| `heuristic_inventory` | a second heuristic agrees | may rise to CONFIRMED | **stays `heuristic_inventory`** |
| `external_scanner` | anything | unchanged rules | stays `external_scanner` |

The scanner's agreement is recorded where it belongs — in `sources[]` — and
that is what §7.5 and the report read. **`evidence_class` describes how the row
was ORIGINALLY OBTAINED and is immutable after emission.**

Why this guard is load-bearing: without it, Phase 7 quietly re-implements the
promotion story 1.1 just removed. A `heuristic_inventory` row that acquired a
`scanner` source would become `external_scanner`, and `external_scanner` is the
**one** class that earns the §7.4 `+1` rung. Two sources would then buy a
severity rung for the 1.4%-true family through a different door — and this time
with no single line of code to point at, because it happened in prose.

The corollary: **a row's `evidence_class` may only ever be set by the thing that
emitted it.** If Phase 7 finds itself computing an `evidence_class`, that is a
bug — the correct fix is upstream, in whichever phase failed to stamp it.

**Do not infer `evidence_class` from `confidence`, or vice versa.** They are
orthogonal, along with `attacked`. `evidence_class` says where the row came
from, `attacked` says whether anyone tried to break it, `confidence` says how
likely it is to describe reality. Conflating the three is the defect this
release exists to fix.

## 7.4 — Severity rubric (final) — CONTEXT SIGNALS ONLY

> ⚠ **Scope of the ±1 cap (v2.6).** This section governs **context-signal
> adjustment** and nothing else. It is one of **two** mechanisms that can move a
> severity, and they have **two different rules**:
>
> | Mechanism | What it is | Cap |
> |---|---|---|
> | **§7.4 context signals** (this section, plus §7.13 and §7.14) | a calibration nudge over **one finding read in isolation** | **±1 rung total**, never stacking |
> | **§7.15 R3 chain composition** | a claim about a **path** — an unprivileged persona reaching a crown jewel | **uncapped**; sets CRITICAL outright |
>
> v2.5 shipped the sentence "±1 rung regardless of how many triggers fire" next
> to a composer that sets CRITICAL, so a reader calibrating on this section
> mis-read every composed severity. **The composer was right and this prose was
> wrong.** R3 must stay uncapped: the founding case was a MEDIUM whose
> mitigation ("only exploitable if the UUID is known") was discharged by a HIGH
> in the same document. Cap R3 at one rung and that finding becomes HIGH —
> which is the rating that let it rot for 96 days. R3 is gated on **evidence**
> instead (§7.15), not on a rung count.

Severity was assigned per finding; Phase 7 may adjust by exactly one
rung based on context signals. **Cap at ±1 rung total regardless of
how many triggers fire** — the promotion is a calibration adjustment,
not a stacking modifier.

**Rule:**

1. Compute the signed signal:

   | Signal | Contribution |
   |---|---|
   | `trust_zone == "public"` | **+1** (promotion) |
   | `evidence_class == "external_scanner"` (v2.6) | **+1** (promotion) |
   | `data_ops ∩ {write, delete, exec} ≠ ∅` | **+1** (promotion) |
   | `trust_zone == "dev"` | **−1** (demotion) |
   | `RETURNS_OTHER_PRINCIPALS_ROWS` on the surface (v2.5) | **+1, and VETOES any demotion** |

   **`evidence_class == "external_scanner"` is the ONLY evidence signal that
   promotes** (v2.6, story 1.1). It replaces v2.5's `confidence == "CONFIRMED"`
   row. `external_scanner` means an independent tool — semgrep, trivy,
   osv-scanner, gitleaks, trufflehog, hadolint — **named in `sources[].detail`**.
   `heuristic_inventory`, `agent_judgement` and `governance` get **zero**; a
   heuristic over an inventory a sub-agent wrote is not a scanner however
   mechanical it is, and calling it one is the category error that handed the
   19.8%- and 1.4%-true families a free rung. Rows with
   `evidence_class == "heuristic_inventory"` have usually been annexed by §7.2b
   before reaching here and carry no severity at all.

2. Sum the signals. If net > 0, promote by exactly one rung. If net
   < 0, demote by one rung. If net == 0, no change. **Regardless of
   magnitude, the adjustment is at most one rung in either direction.**

   **`RETURNS_OTHER_PRINCIPALS_ROWS` dominates the zone weight** (v2.5): when
   set, the net can never be negative, so a dev-zone label cannot demote a
   finding on an endpoint that returns other principals' rows. Data breadth
   outranks a declared trust zone — an "internal" endpoint returning every
   tenant's rows outranks a "public" endpoint returning one. The ±1 cap still
   holds; this only removes the demotion, it does not stack a second rung.

3. Bounds: never exceed CRITICAL at the high end; never fall below
   INFO at the low end.

4. **This cap does not bind §7.15's R3.** A finding may leave §7.4 at HIGH and
   leave §7.15 at CRITICAL, or leave §7.4 at LOW and leave §7.15 at CRITICAL.
   That is not a cap violation; it is a different mechanism answering a
   different question. Record both: `severity_asserted` (the analyst),
   `severity_computed` (after both mechanisms), and `escalation_rules` naming
   which composition rule moved it.

**Examples:**
- MEDIUM finding, semgrep, public, write → net = +3 → promote one
  rung → HIGH. (Not CRITICAL — cap holds.)
- HIGH finding, grep-only, internal zone, read-only → net = 0 → stays
  HIGH.
- LOW finding, semgrep, dev zone → net = 0 → stays LOW.
- MEDIUM finding, semgrep, internal, read → net = +1 → promote →
  HIGH.
- LOW finding, grep-only, dev zone, read → net = −1 → demote → INFO.
- MEDIUM finding, `validate-egress.py:R5` source, public, read → net = **+1**
  (public only — the heuristic contributes zero) → promote → HIGH. In v2.5 this
  read net = +2 and still promoted to HIGH; the difference bites when `public`
  is absent, where v2.5 promoted on the heuristic alone.
- LOW finding contributing to an unprivileged-persona path that reaches a crown
  jewel → §7.4 leaves it LOW, **§7.15 R3 sets it CRITICAL**. Three rungs, and
  correct: the ±1 cap is not in play.

Rationale: the severity **is already set** by the rubric on the
finding itself; this rule is a calibration adjustment based on
*context*. Context is corroborating evidence, not cumulative
severity. One context positive nudges the severity up by one rung;
more positives don't nudge further (they'd be double-counting the
same underlying signal). The symmetric dev-zone demotion captures
the inverse — test fixtures rarely warrant the same severity as
production code with the same finding body.

## 7.4b — Fix contradiction check (v2.6, story 3.3) — MANDATORY, before the roadmap

**The finding and the fix are separate claims and get separately checked.**

The measured case: **six findings on one Postgres-TLS defect. The finding was
right on all six; the fix was wrong on five.** Five prescribed a nine-site
`ssl: { rejectUnauthorized… }` change plus CA bundling; **one** prescribed a
one-word `?sslmode=verify-full` substitution and cited the driver source proving
it. The correct one was in the minority, and the report **merged the wrong text
into its priority list** without noticing that its own findings disagreed with
each other. Nothing checked. Fix text is what gets executed, and it currently
inherits the finding's confidence for free.

### Step 1 — group

Group findings that describe **the same defect**:

1. `(file, line, cwe)` — exact.
2. Fall back to `(fingerprint, cwe)`.

Groups of one are done. A group of two or more goes to Step 2.

### Step 2 — do the fixes actually disagree?

Normalise each `suggested_fix` (lowercase, collapse whitespace, strip code
fences and punctuation) and compare. Two outcomes, and **only the second is a
contradiction**:

- **Same remedy, different words** — e.g. "set `sslmode=verify-full`" vs
  "append `?sslmode=verify-full` to the connection URL". **Merge**: keep the
  longest text, union the citations, and move on. This is not a contradiction
  and must not be reported as one.
- **Different remedies** — they prescribe different edits, to different places,
  or one asserts a change is needed where another asserts it is not. **This is a
  contradiction.** Go to Step 3.

Adjudicate this by *reading* the two texts, not by a similarity score. A
threshold would have merged the Postgres-TLS pair (they share almost every
token: `ssl`, `postgres`, `connection`, `verify`) while they prescribe a
nine-site refactor and a one-word change respectively. **Token overlap does not
measure agreement about what to do.**

### Step 3 — resolve, and never by majority

| Situation | Resolution |
|---|---|
| Exactly one member has `fix_confidence: verified` | **That fix wins.** The others' `suggested_fix` text is **discarded, not merged**. List the discarded texts in the block below so the decision is auditable. |
| Two or more members are `verified` and still disagree | Contradiction **stands**. No fix ships. Emit the block. |
| No member is `verified` | **Ship NEITHER as a roadmap item.** Emit the block. |

**Never resolve by majority, by severity, or by recency.** In the measured case
the correct fix was 1 of 6 and the only one carrying a driver-source citation —
every one of those heuristics picks the wrong text. `fix_confidence: verified`
requires a cited line *in the dependency, driver or API being asserted about*,
which is precisely the evidence the minority fix had and the majority did not.

### ⛔ Step 4 — this withholds the FIX, never the FINDING

**The findings still ship, at full computed severity, in their normal band.**
Only the `suggested_fix` text is withheld, and it is withheld *loudly*. Each
affected finding prints:

> **Suggested fix:** ⛔ **WITHHELD — FIX RECONCILIATION REQUIRED.** <n> findings
> on this defect prescribe conflicting remedies and none is `verified`. See
> *Fix Reconciliation Required*. The defect is real; the remedy is not agreed.

This direction is not negotiable. A check that could suppress a finding because
its remediation text is disputed would be a **severity-suppression mechanism
wearing a quality check's clothes** — the same shape as the wrong refutation
that buried a live HIGH under a heading readers trust (§7.15). The defect's
existence and the defect's cure are independent claims; only the second is in
doubt here.

### Step 5 — emit the block

A `FIX RECONCILIATION REQUIRED` section in the Remediation Roadmap, before the
effort groups:

```markdown
### ⛔ Fix Reconciliation Required

Findings whose remedies contradict each other. **The defects are real.** The
fixes below are NOT roadmap items until one is verified against the dependency,
driver or API it asserts about.

| Defect | Findings | Conflicting remedies | `fix_confidence` |
|---|---|---|---|
| db/client.ts:14 (CWE-295) | 6 | (a) nine-site `ssl:{rejectUnauthorized}` + CA bundle · (b) `?sslmode=verify-full` | all `inferred` |

**To resolve:** cite the line in the driver/dependency that proves which remedy
is correct, set `fix_confidence: verified` on that finding, and re-run Phase 7.
```

Detection is mechanical; run it and do not skip the group of one-line greps:

```bash
python3 - <<'PY'
import json, re, collections

def norm(s):
    """Lowercase, drop code fences, strip punctuation, collapse whitespace.

    Must match the normalisation described in Step 2. A weaker norm (e.g.
    whitespace only) reports 'Escape the output.' and 'escape  the output' as
    two remedies and buries the real contradictions in noise."""
    s = re.sub(r'`{1,3}[^`]*`{1,3}', ' ', str(s or '').lower())
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', s).split())

rows = [json.loads(l) for l in
        open('.claude-audit/current/phase-07-findings-computed.jsonl')
        if l.strip()]
groups = collections.defaultdict(list)
for r in rows:
    if r.get('attacked') == 'refuted' or r.get('annexed_to'):
        continue                      # refutations and annex legs prescribe nothing
    key = (r.get('file'), r.get('line'), r.get('cwe'))
    if key[0] is None or key[1] is None:
        key = (r.get('fingerprint'), None, r.get('cwe'))
    groups[key].append(r)
for key, g in sorted(groups.items(), key=lambda kv: str(kv[0])):
    if len(g) < 2:
        continue
    fixes = {norm(r.get('suggested_fix')) for r in g}
    if len(fixes) < 2:
        continue
    verified = [r for r in g if r.get('fix_confidence') == 'verified']
    print(f"CANDIDATE {key}: {len(g)} findings, {len(fixes)} distinct remedies, "
          f"{len(verified)} verified -> {[r.get('id') for r in g]}")
PY
```

Note the normalisation strips **code fences and inline code**. That is
deliberate and it cuts the other way too: two remedies whose only difference is
inside a backticked snippet normalise to the same string and will **not** be
reported. Step 2 is where you catch that — the script narrows the reading, it
does not replace it.

The script finds **candidates**; Step 2 decides which are real contradictions
and Step 3 resolves them. A candidate you dismiss as "same remedy, different
words" is a judgement you are making — make it deliberately.

## 7.5 — Unique-to-skill identification

Compute the set of findings whose `sources[]` contains NO entry of type
`scanner` AND NO entry with `detail == "security-review"` AND NO entry
with `detail == "adversarial-review"`. These are the skill's
**unique value** — findings that generic scanners and the built-in
reviews missed. Call them out explicitly in the report.

## 7.6 — Methodology coverage matrix

Build a table for the report:

| Methodology | Coverage | Findings tagged |
|---|---|---|
| ASVS 4.0.3 L2 | X% (pass / fail / n.a.) | N |
| OWASP Top 10:2025 (web) | K/10 categories fired (A01..A10) | N |
| API Top 10 (2023) | per-category counts | N |
| LLM Top 10 (2025) | per-category counts (or N/A) | N |
| OWASP Agentic Applications (2026) | K/10 ASI categories fired (or N/A) | N |
| LINDDUN | 7-category counts (or N/A) | N |
| STRIDE | partitions covered | Markdown tables |
| CWE | unique CWEs seen | N |
| CWE Top 25 (2025) | hits / 25 (highest-ranked: #R) | N |
| Authorized-Egress (§6.19) | sinks reconciled / coverage-gate status | N |
| Collection scoping (§6.20) | collections reconciled by row_scope / coverage-gate status | N |
| Severity gate (§7.15) | escalations applied; governance failures outstanding | N |

- **OWASP Top 10:2025 (web)** row reads `phase-06-web-top10.jsonl` (§6.16);
  count categories whose `count > 0`. **Agentic (2026)** row reads
  `phase-06-agentic-top10.jsonl` (§6.17); show `N/A` when that file is
  zero bytes (gate did not fire).
- **CWE Top 25 (2025)** row is computed by §7.13 below.

## 7.13 — CWE Top 25 (2025) prioritization enrichment

**Additive, after §7.4 severity is final. Pure lookup, no fan-out.** Uses
the ranked list in `lib/owasp-web-top10.md` (Part 2) — MITRE CWE Top 25
(2025), published 2025-12-15.

For each finding whose `properties.cwe` matches an in-map `CWE-NNN` row in
that list:
1. Stamp `properties.cwe_top25_2025_rank` = the row's rank (1–25) on the
   finding's SARIF result (and carry it on the in-memory finding).
2. Treat Top-25 membership as a **reporting-priority** signal, surfaced in
   the Executive Summary ("CWE Top 25 (2025) hits: <n>, top-ranked #<r>")
   and as a tiebreaker when ordering findings of equal severity (lower
   rank = list first).

**Severity-cap interaction (MANDATORY — do NOT break §7.4):**
- This enrichment may **raise priority by at most one rung** and **never
  lowers** severity.
- The ±1-rung cap in §7.4 is the single authority **for context-driven
  adjustment**. (It does not bind §7.15's R3 chain composition, which is a
  different mechanism — see the scope box at the top of §7.4.) If §7.4 already
  applied a +1 promotion to a finding, Top-25 membership adds **zero** further
  rungs — it becomes a pure reporting highlight only (no second bump).
- Concretely: the total context-driven promotion for any finding is **≤ +1
  rung** counting §7.4 and §7.13 together. Top-25 never stacks on top of an
  existing §7.4 promotion, and never demotes.

The seven memory-safety entries in the Part 2 list (rendered as `#NNN`,
not `CWE-NNN`) are not in `lib/cwe-map.json`, so they never match a finding
— correct for a web/polyglot audit.

## 7.14 — grype EPSS / CISA-KEV join

**Additive prioritization, after §7.4. Never lowers severity.** Scanner
side already documented in `lib/scanner-bundle.md` (grype EPSS/KEV).

If `phase-04-scanners/grype.json` exists, read it and join onto matching
findings by CVE / GHSA id:
- EPSS probability: `.matches[].vulnerability.epss[0].epss`
- CISA-KEV flag: `.matches[].vulnerability.knownExploited` (boolean)

Match grype entries to findings by vulnerability id (CVE-/GHSA-) — these
appear in dependency/SCA findings' `id`, `title`, or `sources[].detail`,
and in scanner-run SARIF `ruleId`. For each matched finding:
1. Stamp `properties.epss` (numeric string, e.g. `"0.142"`) and
   `properties.kev` (`"true"`/`"false"`) on its SARIF result.
2. If **EPSS ≥ 0.10 OR KEV == true**, add it to an **"Exploit-likely"**
   callout surfaced in the Executive Summary and at the top of the
   Remediation Roadmap.

**Severity-cap interaction:** EPSS/KEV is prioritization-only and
**additive** — it may raise reporting priority but **never lowers**
severity, and like §7.13 it does not stack a second rung on top of any
§7.4 promotion (the ±1-rung cap is authoritative). KEV/high-EPSS findings
that are still only MEDIUM by the rubric stay MEDIUM but are flagged
"Exploit-likely" so triage sees them first.

If `grype.json` is absent, skip silently (grype is optional) and note
"EPSS/KEV: grype not run" in the report's coverage section.

## 7.15 — Severity gate (v2.5) — MANDATORY, runs BEFORE the report is written

**Severity stops being asserted here and starts being computed.**

Everything above rates findings *in isolation*. That is the step that failed: a
CONFIRMED finding whose own description read *"…if the deck UUID is known.
Combined with H1, an attacker can identify published decks and access output
directly"* was filed MEDIUM — while `H1`, a **HIGH in the same document**,
supplied exactly the capability the mitigation assumed nobody had. It went
unremediated for 96 days, was downgraded to LOW at the next baseline, and its
sibling endpoint was affirmatively described as "well-defended (INFO)".

Chain **detection** was not the failure. The chain was written down, in prose, by
a human. Chain **arithmetic** was. This section is the arithmetic.

### Step 1 — run the gate

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/compose-attack-paths.py" \
  .claude-audit/current/phase-05-*.jsonl \
  .claude-audit/current/phase-06-*.jsonl \
  --profile   .claude-audit/current/phase-00-profile.json \
  --baseline  .claude-audit/baseline.json \
  --run-id    "$(jq -r .audit_id .claude-audit/current/phase-00-profile.json)" \
  --max-age-days 30 \
  --out          .claude-audit/current/phase-07-governance.jsonl \
  --rewrite      .claude-audit/current/phase-07-findings-computed.jsonl \
  --json-summary .claude-audit/current/phase-07-severity-gate.json
# Exit 1 is EXPECTED here whenever escalations or governance failures exist.
# Do not swallow it: Step 2 below tells you what to do with each class.
rc=$?; echo "severity gate exit=$rc"
```

(`--baseline` is omitted on a first run — R4 and the lifecycle gates need a prior
baseline to compare against.)

**`--changed-files` — pass LINE RANGES, not bare paths.** A bare path says only
"some line in this file moved", which is not evidence that a particular finding
was addressed; the gate accepts it but records an INFO note saying the
explanation is file-granular. Ranges make the check precise:

```bash
git diff --unified=0 "$(jq -r .git_head .claude-audit/baseline.json)" HEAD \
  | awk '/^\+\+\+ b\//{f=substr($2,3)}
         /^@@/{split($3,a,","); s=substr(a[1],2); n=(a[2]==""?1:a[2]);
               if (n>0) print f":"s"-"(s+n-1)}' \
  > .claude-audit/current/changed-ranges.txt
```

Then pass `--changed-files .claude-audit/current/changed-ranges.txt`.

### Step 2 — apply, then converge

Two distinct classes of exit-1, handled differently:

**(a) Escalations (R1/R2/R3) are auto-applicable.** Replace your in-memory
finding set with `phase-07-findings-computed.jsonl` — it carries
`severity_computed` (authoritative), `severity_asserted` (the analyst's
opinion, retained for provenance), an appended `severity_history` entry, and
`escalation_rules`. **Re-run the gate against the rewritten file.** It must now
exit 0 on the escalation count. If it does not, you did not apply the rewrite.

**(b) Governance failures (R4, L1-L3) are NOT auto-applicable.** They require a
human decision — a fix, an owned acceptance, a recorded reason, or a linked
commit. They must **not** silently disappear:

- The report is still written, but it is **stamped `AUDIT GATE: FAILED` at the
  top of the Executive Summary**, listing each unresolved governance failure.
- **Phase 8 does NOT write a baseline** while governance failures stand (see
  §8.1). This is the load-bearing part: without it, a run that silently
  downgrades a finding would persist that downgrade as the new baseline, and the
  next run would have nothing to ratchet against. **You cannot launder a
  downgrade by re-running.**
- The skill's exit status is non-zero so CI fails.

### The rules, and the failure each one is for

| Rule | Check | Observed failure it exists for |
|---|---|---|
| **R1** | A finding's `precondition` is supplied by another finding's `postcondition` in this same report ⇒ its severity floor is the supplier's. Applied to a fixpoint, so multi-hop chains propagate. | "Only exploitable if the UUID is known" — while a HIGH in the same report handed out the UUIDs. |
| **R2** | Prose matching `combined with\|chained\|together with\|in combination\|…` that names another finding ⇒ severity ≥ that finding's. | Five lines of regex that **alone** would have escalated M6 in March. Fires even with zero capability tags. |
| **R3** | Any path from an **unprivileged** persona reaching a **crown jewel** ⇒ CRITICAL — for the findings that actually *contribute* (backward slice), not every finding that happens to be reachable. **Uncapped** (see §7.4's scope box) and **gated on `deployment_reachability`** (below). | A genuinely-MEDIUM cookie-scope bug is CRITICAL once you notice the persona holding it is external. No analyst makes that call by eye across 60+ findings. |
| **R4** | Severity may not decrease across runs without a `severity_history` entry naming what changed (`fix_commit` / `compensating_control` / `disproven_exploitability` / `rescoped`). A HIGH+ that *disappears* must be matched to a code change or it is itself a finding. | CONFIRMED MEDIUM → LOW → "well-defended (INFO)", while still exploitable. |
| **L1** | A CONFIRMED HIGH/CRITICAL older than 30 days with no `lifecycle.fix_commit` and no unexpired acceptance ⇒ fail. | The 96-day hole. Detection was never the bottleneck; triage-to-fix was. |
| **L2** | HIGH+ cannot be `accepted` without a named owner **and** a live expiry. | "The team says it is fine." |
| **L3** | `verified` requires `verified_by_test`. `fixed` without one is reported. | The fix shipped with no denial test, and a sibling test mocked the very gate it should have pinned — so "fixed" was never mechanically proven, and the class recurred on a different endpoint. |

### R3 escalation is gated on `deployment_reachability` (v2.6, story 1.4)

The defect this closes: a finding **asserted LOW** by the analyst and **computed
CRITICAL** by the composer, on genuine tags and a genuine chain — for a dev-mode
path whose `isDemoCapableEnv` allowlists only `{local, sandbox}` with a
fail-closed `unknown` default. Structurally unreachable in dev, staging and
production. It displaced real work at the top of a priority list. **The analyst
who rated it LOW already knew all of that; the information had no channel to
reach the composer**, which overrode the rating blind. `deployment_reachability`
is that channel.

| `deployment_reachability.state` | Cite required | Suppresses R3? |
|---|---|---|
| absent, or `reachable` | — | **No** |
| `gated_by_runtime_flag` | yes | **No** |
| `structurally_unreachable` **with** a non-empty `evidence` cite | yes | **Yes** |
| `structurally_unreachable` with **no** cite | — | **No** — ignored, and reported |

Three rules, each load-bearing:

1. **Only a member of the contributing slice can suppress.**
   `contributing_slice()` has already walked back from the crown jewel and
   dropped bystanders, so **every remaining member is load-bearing by
   construction** — one unreachable member means the path cannot be walked. No
   special-casing of the chain "entry" is needed, and a bystander cannot veto a
   chain it does not carry.
2. **`gated_by_runtime_flag` does NOT suppress.** A flag an admin can toggle in
   a deployed environment is **live**, not theoretical. Only a build-time or
   deploy-time structural constraint counts. This is the discriminator the
   calibration triage itself drew: *"App mode is toggled at runtime by admins,
   so this is live."*
3. **An uncited `structurally_unreachable` does NOT suppress.** Without the cite
   requirement this field becomes the next self-asserted `CONFIRMED`: a label
   anyone can set that silently buys a severity concession, with nothing
   downstream able to check it. The composer ignores it and prints a warning.

**The asymmetry is deliberate and fail-open toward escalation.** Missing a
reachable chain is unrecoverable; escalating an unreachable one costs triage
time. **Escalation stands by default and only positive, cited evidence stops
it.**

### Read the SUPPRESSED ESCALATIONS section — suppression is now the dangerous direction

The gate prints every escalation it declined, what the severity would have been,
which finding blocked it and the exact cite. **Read every one and check every
cite.**

This block exists for the same reason `refutation_scope` does. The calibrated
run's single worst defect was not a false positive — it was a **wrong
refutation**: a claim true of one module, generalised to a system property, that
filed a live HIGH under a *"What is sound"* heading readers are told to trust.
Two call sites were handing a GitHub App signing key to a function that puts it
in an `Authorization: Bearer` header. A false positive costs a triager minutes
and is self-correcting. A wrong suppression **stops them reading the code**, and
nothing downstream reopens it.

Each suppressed finding carries `escalation_suppressed_by` = the blocking
finding's id, and the summary JSON carries `suppressed_escalations[]`. A
suppression is **never** silent and **never** removes the finding — it only
declines the CRITICAL rung. R1 and R2 still apply.

### Every computed CRITICAL names its rule

`escalation_rules` is stamped on every finding a composition rule moved, and
`severity_history[-1].reason` spells out which rules fired. **An unexplained
CRITICAL is a reporting defect** — in the calibrated run one cluster arrived with
13 of 15 findings CRITICAL, eight of which the analyst had asserted LOW or INFO,
and nothing in the output said which rule did it or why. When rendering a
CRITICAL, print the rule (`R1` / `R2` / `R3`) and the chain that produced it.

### Read the ORPHAN CAPABILITIES section

The gate prints preconditions no finding or persona supplies, and postconditions
that feed nothing. That list is the drift alarm: a chain that should have
composed and did not, usually because two sub-agents named the same capability
differently. Reconcile the vocabulary against
[`../lib/capability-lexicon.md`](../lib/capability-lexicon.md) and re-run — do
not ignore it. **An empty orphan list is evidence the arithmetic actually ran;
a long one means the gate is quietly inert.**

The same block now carries **capability provenance** (v2.6, story 1.3): every
capability tag minted *only* by `heuristic_inventory` rows is listed with the
finding and `rule_family` that minted it, and marked
`[CARRIED AN ESCALATING CHAIN]` when it appears in a contributing slice. A tag
used to be an anonymous string, so a chain resting on a heuristic guess was
indistinguishable in the output from one resting on a human reading the code —
and **47% of the calibrated run's 1120 tags were minted by the C-rules with no
evidence check at all**. Treat anything marked `[CARRIED AN ESCALATING CHAIN]`
as requiring the minting finding to be verified before its CRITICAL is believed.

### ORPHAN ANNEXES

Heuristic rows that found no judgement twin in §7.2b. Render them as the
low-confidence lead list described there — **capped out of the headline
severity band**, labelled with `rule_family`, never dropped.

### The severity contract (machine-checked)

The block below is **parsed by `tests/test-attack-paths.sh` and diffed against
`python3 lib/compose-attack-paths.py --print-contract`**. If you change either
side, the test fails until both agree. This exists because v2.5 shipped prose
saying "±1 rung regardless of how many triggers fire" alongside a composer that
set CRITICAL outright, and **nothing detected the contradiction for a whole
release** — the two were only ever compared by reading.

```severity-contract
context_signal_cap_rungs = 1
promotable_evidence = external_scanner
r3_escalation_target = CRITICAL
r3_escalation_capped = false
r3_suppressing_state = structurally_unreachable
r3_suppression_requires_cite = true
r3_nonsuppressing_states = reachable,gated_by_runtime_flag
annexed_rows_in_graph = false
```

### Honest scope

The composer can only compose what was tagged, and a capability nobody wrote
down joins nothing. R2 is the backstop for untagged chains named in prose, and
the orphan list is the backstop for the backstop — but neither makes this
complete. What v2.5 changes is that the failure is now **loud** rather than
silent, and that a tagged chain can no longer be out-voted by instinct.

## 7.7 — Emit `phase-07-report.md`

Use the template in `lib/report-template.md`. **The template is authoritative
for structure**; this section says how to fill it. Sections in order:

1. **Header** — project name, audit id, skill version, generated-at,
   scope, duration.
2. **Executive Summary** — total findings, by severity, the **Evidence mix**
   (below), by confidence. Top 3 risks (one line each). Plus: **CWE Top 25
   (2025) hits** (§7.13) and the **"Exploit-likely" callout** (EPSS ≥ 0.10 OR
   KEV=true, §7.14) when either is non-empty.
3. **Partition Risk Ranking** — table from Phase 1 with finding counts
   appended per partition.
4. **Findings** — **class-major, severity-minor.** See §7.7a below. This
   replaces v2.5's severity-major ordering; do not fall back to it.
5. **Attack Surface Summary** — from Phase 2, counts by category,
   noteworthy surfaces listed.
5c. **Collection Scoping (row-level access control)** — from §6.20.
   Report: collections inventoried by `row_scope`; the fail-closed coverage-gate
   status; every C1/C2 finding WITH its `verification_probe`; the C4 tests that
   pin insecure behaviour; and the `public_resources` allowlist again in this
   context (it is the one place "we decided this is public" is auditable). State
   the caveat plainly: a clean reconciliation means every *known* list-query
   candidate was accounted for and scoped — not that no unscoped path exists.

5d. **Severity Gate (computed severity + lifecycle)** — from §7.15.
   Report: escalations applied with the rule that fired and the from→to rungs;
   per-persona reachability and any crown jewels reached; unresolved governance
   failures (R4/L1-L3) as a **blocking** list; and the ORPHAN CAPABILITIES list
   (including the v2.6 capability-provenance lines) with a one-line note on what
   it means. If any governance failure stands, the Executive Summary opens with
   `AUDIT GATE: FAILED` and Phase 8 is skipped.

   **Plus, as their own headed blocks (v2.6):**
   - **SUPPRESSED ESCALATIONS** — from the gate's `suppressed_escalations[]`.
     Every declined CRITICAL, the finding that blocked it, and the cite.
     Mandatory even when the list is long. Suppression is the dangerous
     direction (§7.15); a silent one is the same defect class as a wrong
     refutation.
   - **ORPHAN ANNEXES** — from `orphan_annexes[]`, rendered per §7.2b as an
     explicitly-labelled low-confidence lead list, **capped out of the headline
     severity band** and excluded from the executive summary's CRITICAL/HIGH
     counts.
   - Annexed rows appear **only** inside their parent finding's fix surface
     (`sibling_sites`), never as findings of their own.

5b. **Authorized-Egress (cross-layer access control)** — from §6.19.
   Report: sensitive-resource count (default-deny) + the `public_resources`
   allowlist for human review; egress sinks inventoried + candidates dismissed;
   the fail-closed **coverage gate** status; the cross-layer / missing-enforcer
   findings WITH their `verification_probe` (the request that should fail). Close
   with the honest caveat: a clean reconciliation is high-signal, **not** a proof
   of absence; list any `coverage: caveat` modalities (e.g. CDN-edge) explicitly.
6. **Methodology Coverage** — the §7.6 matrix (add the Authorized-Egress row).
7. **STRIDE Tables** — per-partition, inline from phase-06-stride/*.md.
8. **ASVS Checklist** — summary then per-category breakdown.
9. **Route Inventory** — first 50 rows (truncated with count).
10. **Unique-to-Skill Findings** — §7.5.
11. **Audit Coverage** — per-phase status (completed / degraded /
    skipped) with notes, plus the §7.7a routing assertion count.
12. **Remediation Roadmap** — the `FIX RECONCILIATION REQUIRED` block (§7.4b)
    first, then grouped by effort (trivial / small / medium / large).

## 7.7a — Findings ordering: CLASS-MAJOR, SEVERITY-MINOR (v2.6, story 1.5)

⛔ **v2.5 ordered the Findings section by severity, with category sub-groups.
That ordering is retired. Do not emit it.**

Severity-major with class sub-bands is not a fix, and this is the trap worth
naming: it *looks* like it satisfies "no band mixes `evidence_class`" while
still pointing the reading path at the worst pile first. A CRITICAL heading
containing a `heuristic_inventory` sub-band still puts an 11%-true row above a
92%-true MEDIUM, because readers read top-down. **The measured harm was the
reading order, not the heading labels.** In the calibrated run 60% of the HIGH+
population came from the families that supplied 15% of the true findings, and
the report's own advice — "read the confidence bands" — sent triagers to the
worst pile first and the best pile last.

So: **the outer key is `evidence_class`, the inner key is severity.**

### Routing — total, exclusive, evaluated in this order

Every row lands in exactly one place. A row matching nothing is a **bug**, not
a row to drop.

| # | Test | Destination |
|---|---|---|
| 1 | `attacked == "refuted"` | **What Is Sound** — not a band, not in the Findings Index |
| 2 | `annexed_to` is set | **no row of its own** — appears only inside its parent's `sibling_sites` |
| 3 | `evidence_class == "heuristic_inventory"` | **Annex** (leads) |
| 4 | `evidence_class == "governance"` | **§ C** |
| 5 | `evidence_class == "external_scanner"` | **§ B** |
| 6 | `evidence_class == "agent_judgement"` | **§ A** |

**Assert before emitting**, and print the result in the Audit Coverage table:

```
|§A| + |§B| + |§C| + |Annex| + |What Is Sound| + |annexed legs| == total rows
```

Test 1 precedes the class tests deliberately: a refuted row is a **negative
claim** and belongs with the other negative claims regardless of who made it.
Test 2 precedes the class tests because an annex leg is not a row at all.

Within **§ A** and **§ B**, order by severity CRITICAL → INFO. Omit any
severity sub-heading with zero rows; omit an entire class section with zero
rows. **Do not merge a thin band into its neighbour to avoid printing an empty
one** — that is how classes get mixed.

**§ C (governance)** is a flat severity-ordered list, not sub-banded: these are
claims about the audit's own state and a reader triaging them is doing a
different job.

### Placeholder semantics

| Placeholder | Value |
|---|---|
| `n_ev_judgement` / `n_ev_scanner` / `n_ev_heuristic` / `n_ev_governance` | Row counts per `evidence_class` **after** routing. `n_ev_heuristic` counts annex leads (attached + orphan); annexed legs are counted there, not in §A/§B. |
| `findings_index_rows` | One row per **§A + §B + §C** finding, severity-ordered: `\| Severity \| Evidence \| § \| ID \| Title \| Location \|`. **Excludes** refutations, annex legs and annex leads — a severity-ordered index containing an 11%-true lead re-creates the exact harm §7.7a exists to remove. The `Evidence` column is mandatory on every row; the `§` column names the band the finding is argued in. |
| `judgement_critical_block`, `judgement_high_block`, `judgement_medium_block`, `judgement_low_block`, `judgement_info_block` | Per-finding blocks (template format) for `agent_judgement` at that severity. Empty string when none — the emitter omits the heading too. |
| `scanner_critical_block`, `scanner_high_block`, `scanner_medium_block`, `scanner_low_block`, `scanner_info_block` | Same for `external_scanner`. |
| `governance_block` | Per-finding blocks for `governance`, severity-ordered, no sub-headings. |
| `escalation_rules_note` | When `severity_computed` > `severity_asserted`: `, via {{escalation_rules joined by "/"}}` (e.g. `, via R1/R3`). Empty string otherwise. **A finding whose computed severity exceeds its asserted severity with an empty `escalation_rules` is a bug** — report it in Audit Coverage rather than printing a bare arrow. |
| `refutation_rows` | One row per `attacked == "refuted"` finding **that has a non-empty `refutation_scope`**: `\| # \| Host category \| Claim refuted \| Boundary examined \| Confidence \| Evidence \|`. Host category from the row's `notes`. Apply the template's four emitter rules — they are hard. |
| `unscoped_refutation_ids` | Ids of refutations with **no** `refutation_scope`. These do **not** print as rows; they print here so the omission is visible. Comma-separated, or `none`. |
| `n_refutations` | Count of **printed** (scoped) refutations — the ones the "— all scoped" claim covers. Unscoped ones are counted in `unscoped_refutation_ids` and nowhere else. |
| `annex_lead_count` | All `heuristic_inventory` rows = attached + orphan. |
| `annex_attached_count` | Those with `annexed_to` set (from the gate's `annexed_rows[]`). |
| `annex_orphan_count` | Those without (from the gate's `orphan_annexes[]`). |
| `annex_orphan_list` | The orphan lead list: `rule_family`, `file:line`, title. **No severity column** — these carry none. |
| `annex_precision` | See §7.7b. |
| `sibling_sweeps_run` | HIGH+ findings in §A + §B carrying a non-empty `sibling_pattern`. A sweep is "run" when a pattern was recorded, whether or not it found anything. |
| `n_high_plus` | HIGH+ findings in §A + §B. Leads are excluded — they are not HIGH+, they are not rated. |
| `sibling_sites_total` | Sum of `len(sibling_sites)` across those findings — the additional sites the sweeps found. |

### 7.7b — Precision figures: print "not yet measured", never omit

The "How to read this report" table carries a **Last measured precision**
column, read from `manifest.yaml` `rule_family_precision` (the story 4.5
standing calibration control).

**That key does not exist yet.** Until it lands:

- Print the column. Print `not yet measured` in every cell with no recorded
  rate.
- **Do not omit the column, and do not omit the table.**
- **Do not invent, interpolate or carry forward a number.** The figures in the
  template's prose (92.1% / 96.6% / 11.0%) are the calibrated-run measurements
  for *that* codebase and are cited there as history — they are not this run's
  rates and must not be printed as though they were.

Absence of data is not evidence of precision. An unlabelled band is exactly
what this section exists to replace: the v2.5 report called a population "the
trustworthy spine" with no measurement at all, and half of it was 9.6% true.
`not yet measured` is an honest cell; a missing column silently restores the
unlabelled band.

## 7.8 — Emit `findings.sarif`

### 7.8.0 — Assert id uniqueness BEFORE writing (v2.6, story 4.1) — MANDATORY

`§7.2` Pass 0 deduplicates on `id`. This is the hard gate that proves it worked.
**Run it against `phase-07-findings-computed.jsonl` and do not write SARIF if it
fails** — a duplicate id makes every downstream join ambiguous and every
headline count wrong.

```bash
python3 - <<'PY'
import json, sys, collections
rows = [json.loads(l) for l in
        open('.claude-audit/current/phase-07-findings-computed.jsonl')
        if l.strip()]
ids = [r.get('id') for r in rows]
dupes = {i: n for i, n in collections.Counter(ids).items() if n > 1}
missing = sum(1 for i in ids if not i)
if dupes or missing:
    print(f"FAIL: {len(rows)} rows, {len(set(ids))} distinct ids, "
          f"{missing} with no id", file=sys.stderr)
    for i, n in sorted(dupes.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {n}x  {i}", file=sys.stderr)
    sys.exit(1)
print(f"id uniqueness OK: {len(rows)} rows, {len(set(ids))} distinct ids")
PY
```

The v2.5.0 run wrote **1361 rows with 1256 distinct ids** and no such gate.
Seven `config` ids appeared six times each with three distinct payloads among
them; nine surplus rows were HIGH+.

### 7.8.1 — Structure

Single SARIF 2.1.0 document with `runs[]` = one run per scanner + one
synthetic run named `security-audit-skill` for the grep/manual findings.

Required per SARIF 2.1.0:
- `$schema`: `https://json.schemastore.org/sarif-2.1.0.json`
- `version`: `2.1.0`
- `runs[]`: each with `tool.driver.name`, `tool.driver.rules[]`,
  `results[]`.

**Which findings get a `results[]` row.** Every deduplicated finding, **except
rows carrying `annexed_to`** — those are enumeration legs of another finding
(§7.2b) and get **no `results[]` row of their own**. Their content is not lost:
each one appears in its parent's `properties.sibling_sites`, which is what
carries the fix surface (the nine legs of a class, at exact line granularity)
into the machine-readable output. **Orphan annexes DO get a row** — they are the
only coverage of their area — carrying `properties.evidence_class =
"heuristic_inventory"` and no `annexed_to`, which is how a consumer tells a lead
from a finding.

Every `results[]` item in the synthetic `security-audit-skill` run:
- `ruleId`: the finding's **`rule_family`** if set, else `<category>/<CWE>`.
  `ruleId` is a *rule* identifier and SARIF consumers group on it; it is **not**
  the finding identifier — see `properties.id` below.
- `level`: SARIF maps from our severity — CRITICAL/HIGH → `error`,
  MEDIUM → `warning`, LOW/INFO → `note`
- `message.text`: title + description
- `locations[0].physicalLocation.artifactLocation.uri`: `file`
- `locations[0].physicalLocation.region.startLine`: `line`
- `partialFingerprints.primary`: the dedup fingerprint
- **`properties.id` (v2.6 — REQUIRED)**: the finding's stable `id`, verbatim.
  **This is the single most important property on the row.** The calibrated
  v2.5.0 SARIF carried 1361 results and **no finding id at all**: `ruleId` was
  only `<category>/<CWE>` (e.g. `agentic/CWE-269`), which is neither unique nor
  joinable. When eight engineers produced 255 per-finding verdicts, **the
  verdicts could not be mechanically joined back to the SARIF** and the entire
  calibration had to be rebuilt from `phase-07-findings-computed.jsonl`. Without
  this property no future measurement can key on a SARIF at all, and
  `scripts/calibration-report.py` has nothing to join on.
- **`properties.rule_family` (v2.6 — REQUIRED)**: e.g. `deepdive:cat-02`,
  `validate-egress:R5`, `scanner:semgrep`, `asvs`. Per-family precision cannot
  be measured across runs without it.
- **`properties.evidence_class` (v2.6 — REQUIRED)**: `external_scanner` /
  `heuristic_inventory` / `agent_judgement` / `governance`. This is what lets a
  consumer band the results correctly (§7.4, and the report may never mix
  classes in one band).
- **`properties.attacked` (v2.6 — REQUIRED)**: `not_attempted` / `confirmed` /
  `partial` / `refuted`.
- **`properties.annexed_to` (v2.6 — where set)**: present only on orphan-annex
  rows, which is to say never in practice — a row with a parent gets no
  `results[]` entry at all. Emit it if set, so the contract is unambiguous.
- **`properties.sibling_sites` (v2.6)**: the JSON array from the finding,
  including every annexed leg folded in by §7.2b. This is where the fix surface
  lives once the legs stop being their own rows.
- **DROPPED in v2.6: `properties.verification_status`.** The field no longer
  exists — it was a run-level artifact of §6.19/§6.20 that appeared nowhere in
  the skill and silently recorded *which phase emitted the row*. Its successor is
  `properties.attacked`. **Do not emit `verification_status`.**
- `properties.security-severity`: CVSS-compatible numeric (CRITICAL=9.0,
  HIGH=7.0, MEDIUM=5.0, LOW=3.0, INFO=1.0) — consumed by GitHub Security
  tab. **Meaning is unchanged in v2.6**; it follows `severity_computed` and
  nothing else, because the GitHub Security tab reads it.
- `properties.cwe`: the CWE id as a string (e.g. `"CWE-798"`). Required
  for fixture matching, baseline carryover, and GitHub Security tab
  grouping. Look up in `lib/cwe-map.json`.
- `properties.category`: one of the 13 category slugs (`auth`, `idor`, `token_scope`, `collection_scope`, `mitm`, `crypto`, `secret_sprawl`, `deployment`, `injection`, `llm`, `supply_chain`, `agentic`, `config`). Recommended.
- `properties.cwe_top25_2025_rank` (optional): integer 1–25 when the
  finding's CWE is in the 2025 CWE Top 25 (§7.13).
- `properties.epss` / `properties.kev` (optional): EPSS probability and
  CISA-KEV flag joined from grype (§7.14). Additive prioritization signals
  only — they never change `level` or `properties.security-severity`.
- `properties.verification_probe` (optional): for Authorized-Egress (§6.19) and
  collection-scoping (§6.20) findings, the JSON `{request, expected, actual}` —
  the executable proof (the request that should fail). Carry it through verbatim
  so a triager can run it.
- `properties.severity_asserted` / `properties.severity_computed` (v2.5): when
  they differ, the SARIF `level` and `security-severity` follow **computed**.
  Emit both so a reader can see that the rating was raised by path arithmetic
  rather than by opinion, and `properties.escalation_rules` naming which rule
  fired. **Every result whose `severity_computed` exceeds `severity_asserted`
  MUST carry a non-empty `escalation_rules`** (v2.6) — an unexplained CRITICAL
  is a reporting defect.
- `properties.escalation_suppressed_by` (v2.6, optional): the id of the finding
  whose cited `structurally_unreachable` blocked an R3 escalation to CRITICAL.
  Emit it wherever the composer set it, so a suppression is as visible to a
  machine as it is in the report.
- `properties.deployment_reachability` (v2.6, optional): the `{state, evidence}`
  object verbatim. It is the evidence a suppression rests on and must travel
  with the row.
- `properties.first_seen_at` (v2.5): carried from the baseline. This is what
  makes an ageing HIGH visible in the GitHub Security tab rather than looking
  identical to one found this morning.

**Scanner-run results.** Per-scanner SARIF runs (semgrep, trivy, etc.)
emit CWE in scanner-specific locations — `tags[]`, `rule.properties.tags`,
or driver `relationships`. The skill copies those runs through
*verbatim* — do NOT rewrite scanner results to add `properties.cwe`
where they already encode CWE elsewhere.

⛔ **"Verbatim" is scoped to metadata, never to credential material.** The runs
being copied here are the redacted ones from `phase-04-scanners.md §4.4b`. The
raw gitleaks and trufflehog reports carry the matched secret in
`region.snippet.text` and `Raw`/`RawV2`, and copying *those* through is the
v2.6.0 defect that put a live token into a user's git history. If a run in
`phase-04-scanners/` still has an unredacted `snippet`, §4.4b did not run —
stop, run it, and do not assemble SARIF until `--check` exits 0. A finding row
whose `properties.redacted` is `"true"` is the expected state, not a problem. The per-result-CWE mandate
applies to the synthetic skill run only; scanner-run CWE is consumed by
the assertion suite via the same multi-source extraction logic that
`tests/e2e/assertions.py:_sarif_result_to_finding` uses (it inspects
`ruleId`, `properties.cwe`, `properties.cwes`, and `tags`).

Validate with `jq -e .runs .` before write.

## 7.9 — Emit `findings.cyclonedx.json`

If trivy produced `phase-04-scanners/sbom.cyclonedx.json`, copy and
annotate with findings (`vulnerabilities[]` list pointing to
`findings.sarif` entries).

If no SBOM is available, emit a minimal CycloneDX skeleton with the
detected languages / frameworks from Phase 0 and note "SBOM
incomplete — install trivy or syft for full coverage".

## 7.10 — Save user-facing deliverables

Resolve `<output_dir>` per [../lib/output-routing.md](../lib/output-routing.md)
(already resolved + persisted in `.claude-audit/config.json` during preflight;
read it from there, default `docs/security-audit-output/`). Then, AFTER the
blackboard files exist:

⛔ **Gate first. Every `cp` in this section is downstream of it.**

```bash
OUT=$(jq -r '.output_dir // "docs/security-audit-output"' .claude-audit/config.json 2>/dev/null || echo docs/security-audit-output)
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }

# Fail-closed credential gate. Exit 3 means it scrubbed something -> §7.10a.
python3 "$SKILL_DIR/lib/verify-deliverable.py" --redact \
    --json-report .claude-audit/current/deliverable-gate.json \
    .claude-audit/current/phase-07-report.md \
    .claude-audit/current/findings.sarif \
    .claude-audit/current/findings.cyclonedx.json
GATE_RC=$?
[ "$GATE_RC" -eq 2 ] && { echo "FATAL: deliverable gate could not run" >&2; exit 1; }
# RC 3 obliges §7.10a. Leaving that obligation to prose would be a control with
# no enforcer, which is this skill's own flagship defect class. The marker makes
# it a checkable artifact: §7.12 refuses to write phase-07.done while it exists
# without a matching skill_self_leak finding.
[ "$GATE_RC" -eq 3 ] && touch .claude-audit/current/phase-07-gate-fired.marker

mkdir -p "$OUT"
cp .claude-audit/current/phase-07-report.md      "$OUT/security-audit-report.md"
cp .claude-audit/current/findings.sarif          "$OUT/findings.sarif"
cp .claude-audit/current/findings.cyclonedx.json "$OUT/findings.cyclonedx.json"
```

The gate scrubs the blackboard copies **before** the `cp`, so the blackboard and
the deliverable stay byte-identical. A gate that only cleaned the deliverable
would leave the raw value in `.claude-audit/current/` and then in
`.claude-audit/history/<ts>/` forever.

Echo `$OUT/security-audit-report.md` to the user. (The pruned baseline is
copied to `$OUT/` by Phase 8, behind the same gate.)

## 7.10a — When the gate fires (`GATE_RC == 3`)

The gate firing means credential material reached the deliverable stage. The
Phase 4 ingest strip is structural and covers scanner output completely, so a
hit here almost always came from the one source it cannot reach: **prose an
analyst wrote.** `cat-06-secret-sprawl.md` sends a sub-agent looking for literal
credentials, and a finding that quotes the value it found puts that value into
a tracked markdown file.

When `GATE_RC == 3`, Phase 7 MUST:

1. Read `.claude-audit/current/deliverable-gate.json` (it holds detector names,
   file, line, fingerprint and length — never the value).
2. Emit **one CRITICAL finding** into the report, before the severity counts:
   - `category: secret_sprawl`, CWE-532, `skill_self_leak: "true"` on the
     finding (carried to the SARIF result as `properties.skill_self_leak`)
   - `evidence_class: external_scanner`, `confidence: CONFIRMED`
   - Title: *"The audit's own pipeline carried credential material into a
     deliverable (skill defect)"*
   - Body must state plainly that **this is a defect in the audit tool, not a
     finding about the audited code**, name the detectors that fired, and give
     the same rotate-then-purge fix as `phase-04-scanners.md §4.4c`.
3. Say it in the §7.11 summary to the user — not only in the report body.
4. Clear the marker only once the finding exists:

   ```bash
   grep -q '"skill_self_leak"[[:space:]]*:[[:space:]]*"true"' \
       .claude-audit/current/phase-07-findings-computed.jsonl \
     && rm -f .claude-audit/current/phase-07-gate-fired.marker \
     || { echo "FATAL: gate fired but no skill_self_leak finding was emitted" >&2; exit 1; }
   ```

   A leftover `phase-07-gate-fired.marker` at the phase-completion check
   (`workflow.md §3`) is a hard stop. The obligation is mechanical, not
   narrative.

⛔ **Never suppress the gate, never `|| true` it, and never treat a fired gate
as a finding about the user's repository.** It is this skill's own bug, and the
audit that silently cleans up after itself is the audit that shipped this
defect for four minor versions.

## 7.11 — Report summary to user

> Security audit complete.
>
> - **Total findings:** <N> (<C> CRITICAL, <H> HIGH, <M> MEDIUM, <L> LOW, <I> INFO)
> - **Evidence mix:** <J> agent judgement, <S> external scanner, <G> governance
>   — plus <A> heuristic-inventory **leads** (not findings, §7.2b)
> - **Partitions audited:** <N> at full depth, <K> inventory-only
> - **Confidence mix:** <X> CONFIRMED, <Y> LIKELY, <Z> POSSIBLE
>   (`confidence` is not provenance and not a reading order — that is the
>   evidence mix above)
> - **Unique-to-skill findings:** <U>
> - **Report:** `<output_dir>/security-audit-report.md`
> - **SARIF:** `<output_dir>/findings.sarif` (also in
>   `.claude-audit/current/findings.sarif`; upload to GitHub Security tab via
>   `gh security-advisory` or CI integration)
>
> **Next steps:**
> 1. "fix finding <id>" — fix a specific finding
> 2. "fix all CRITICAL and HIGH findings" — batch remediation
> 3. "create a GitHub issue for this report" — file triage ticket
>
> Re-run `/security-audit mode: delta` after fixes to verify remediation
> in sub-minute runtime.

## 7.12 — Edge cases

- **Empty findings.** Emit the report anyway with "Clean — no findings"
  sections. Do not skip the run.
- **Oversized report.** If `phase-07-report.md` exceeds 1MB, move the
  findings list to `phase-07-findings.md` and reference from the main
  report. Keep executive summary + top risks in the main file.
- **SARIF validation failure.** Log the JSON error, keep the raw output,
  write a `.json` version instead of `.sarif`; note in the report.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/findings.sarif # (plus phase-07-report.md, findings.cyclonedx.json) \
  && test -f .claude-audit/current/phase-07.done \
  && echo "phase-07 verified" \
  || { echo "phase-07 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-07 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
