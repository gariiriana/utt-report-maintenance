# Phase 1 — Partition & Risk Rank

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/partitions.json` (list of partition structs with id, path, risk score, depth, paths_included)
- `.claude-audit/current/phase-01-coverage.json` (§1.6b coverage gate report — proves every source file maps to a partition)
- `.claude-audit/current/phase-01.done`

⛔ **DO NOT advance to Phase 2** until both files exist AND the Verify block at the bottom prints `phase-01 verified`.

📖 `partitions.json` drives Phase 5 fan-out. Missing or malformed partitions collapse the deep-dive fan-out into a shallow single-pass review that misses per-class bugs.

---

**Goal.** Split the repo into audit partitions and score each by risk so the
deep-dive budget goes where it matters.

**Input.** `.claude-audit/current/phase-00-profile.json` from Phase 0.

**Output.** `.claude-audit/current/partitions.json` conforming to
`lib/partitions-schema.json`. Partitions sorted by `risk.score` descending.

**Budget.** Single orchestrator pass. No sub-agents.

---

## 1.1 — Partitioning Algorithm (run top-to-bottom; stop at the first axis
that applies; apply later axes only to refine)

### Axis 1 — Monorepo workspaces (preferred when present)

If `profile.topology.tool` is set and `profile.topology.workspaces` is
non-empty, **each workspace becomes one partition**. Record `kind: "workspace"`
and keep the workspace name as the partition id.

### Axis 2 — Container / service boundary

If `profile.topology.services` is non-empty **and** Axis 1 did not apply, each
service path becomes one partition. Record `kind: "service"`.

If both axes apply (e.g., a pnpm monorepo with one workspace that also has a
Dockerfile), prefer Axis 1 but annotate the partition with
`container_boundary: true` if a Dockerfile is present at the workspace root.

### Axis 3 — Language boundary (secondary)

Within each partition from Axis 1 or 2, if the partition contains >1 language
with >5K LOC each, consider splitting by language. Only split if one language
is clearly an auxiliary tool (e.g., a Python data pipeline inside a TypeScript
app).

### Axis 4 — CODEOWNERS paths (fallback when 1-3 yielded nothing or one partition)

If the repo has no monorepo tool and no service boundary (resulting in a
single partition), check `.github/CODEOWNERS` or `CODEOWNERS`. If present and
it assigns non-overlapping path globs to distinct teams, partition by owner.
Record `kind: "codeowners"`.

### Axis 5 — Dependency-graph communities

Only apply if Axes 1-4 yield a single partition **and** the repo exceeds 120K
LOC. Build a module import graph (language-specific) and run a simple community
detection pass. This is expensive and rarely needed — skip it in M1 (note the
decision in `notes[]`).

### Axis 6 — LOC rebalancing (always applied after axes 1-5)

After the primary axes, rebalance:
- **Split** any partition with `loc > 120000`. Split by subdirectory with the
  highest LOC first, then recurse until each sub-partition is ≤120K.
- **Merge** adjacent partitions with `loc < 3000` that share a CODEOWNER or
  language, to avoid noisy micro-partitions.

**Proactive deep-dive splitting (for Phase 5).** Phase 1 should also
pre-split any partition whose `loc > 125000` (the ≈500K-token soft
ceiling for Phase 5 sub-agents) **before** Phase 5 runs — rather than
reactively letting the first sub-agent hit the ceiling and return
`needs_recursion`. The pre-split partitions carry the parent's
`risk.score` and `depth`. This avoids burning a sub-agent invocation
to discover something the partitioner could have known from LOC alone.

### Axis 7 — Git-log heat (PRIORITIZATION ONLY, not partitioning)

Compute `git log --since="6 months ago" --name-only --pretty=format: | sort |
uniq -c | sort -rn | head -100` to identify hot files. This feeds the
`age_factor` of the risk score; it does **not** create new partitions.

### Single-partition fallback

If after all axes there is exactly one partition, that is fine. The whole repo
is one partition named after the repo directory. Record `kind: "repo"`.

## 1.2 — Per-Partition Metadata

For each partition, compute:

| Field | How to compute |
|---|---|
| `id` | slug of the partition path (`services/api` → `services-api`); unique |
| `kind` | from axis (above) |
| `path` | root of the partition |
| `paths_included` | glob list; at minimum `<path>/**` |
| `paths_excluded` | include anything in `ignore.txt` that nests under `path` |
| `loc` | from `profile.repo.loc_by_language` filtered to this partition |
| `languages` | languages present in this partition, sorted by LOC |
| `frameworks` | frameworks from Phase 0 whose `evidence` file lives under this partition |
| `container_boundary` | true if `Dockerfile` at partition root |

## 1.3 — Risk Scoring (0-9)

Compute three sub-scores, sum to 0-9:

### Exposure (0-3)

| Score | Criterion |
|---|---|
| 3 | Partition is public-ingress (from `profile.trust_zones`, zone = "public") |
| 2 | Internet-facing but behind a gateway / WAF (still "public" but with a mentioned gateway) |
| 1 | Internal only (zone = "internal") |
| 0 | Dev / tooling only (zone = "dev" or partition is entirely tests / scripts) |

If Phase 0 left trust zones ambiguous, default to **2** (conservative) and
note the assumption.

### Sensitivity (0-3)

| Score | Criterion |
|---|---|
| 3 | Touches payments, auth credentials, or secrets (entities matching `tokens|keys|secrets|payments|cards|subscriptions`) |
| 2 | Touches PII (partition contains one of the entities with `pii_cols` non-empty) |
| 1 | Metadata-only (logs, analytics, telemetry) |
| 0 | No data layer in this partition |

### Age / Complexity (0-3)

| Score | Criterion |
|---|---|
| 3 | Partition's oldest commit is >2 years old **and** its path name contains `legacy` / `admin` / `v1` |
| 2 | Oldest commit >2 years old |
| 1 | Oldest commit 6-24 months old |
| 0 | Oldest commit <6 months old |

Compute the oldest commit via `git log --follow --format=%ai --diff-filter=A -- <path> | tail -1`. If unknown, default to 1 and note the assumption.

### Sum

`risk.score = exposure + sensitivity + age`. Range 0-9.

Include a `risk.rationale` free-text field (≤200 chars) summarizing the
drivers.

## 1.4 — Deep-Dive Budget

Sort partitions by `risk.score` descending. Read the `top_n` value from
the invocation dict (parsed per `workflow.md §0`). Default when
unspecified: **8**.

- Top `top_n` partitions receive `depth: "full"`.
- Remaining partitions receive `depth: "inventory-only"` — they still get
  Phase 2 surface enumeration, but Phase 5 deep-dive sub-agents do not spawn
  for them.

If `top_n >= partitions.length`, every partition is at full depth; there
is no inventory-only tail. Record the effective value in the emitted
manifest's `deep_dive_budget.top_n` for downstream traceability — this
field is the *effective* cap applied, not just the user's request.

Emit:
```json
{
  "deep_dive_budget": {
    "top_n": 8,
    "full_depth_count": 5,
    "inventory_only_count": 2
  }
}
```

(counts are `min(top_n, partitions.length)` and the remainder)

## 1.5 — Emit the Partition Manifest

Write to `.claude-audit/current/partitions.json`.

## 1.6b — Coverage gate (MANDATORY, v2.5) — assert partition coverage

**Why this exists.** In the audit that missed a CRITICAL authorization defect,
one of the three independent reasons was pure bookkeeping: `server/api/content/`
matched **no** partition path-glob and fell through silently — *"explicit
partition membership: NONE"*. An entire directory of HTTP handlers left the audit
without a word. Coverage was assumed; it was never asserted.

Run, before writing `phase-01.done`:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/validate-partition-coverage.py" \
  .claude-audit/current/partitions.json \
  --source-root . \
  --ignore .claude-audit/ignore.txt \
  --out .claude-audit/current/phase-01-coverage.json \
  || { echo "phase-01 FAILED the partition coverage gate — do NOT advance" >&2; exit 1; }
```

Non-zero exit means at least one source file belongs to **no** partition.
**That fails Phase 1.** Do not paper over it with a catch-all `**` partition —
the script reports catch-alls separately for exactly that reason, and a
catch-all converts "unmatched" into "silently swallowed", which is strictly
worse. Fix it by adding the missing partition (usually the right answer: an
unglobbed handler directory deserves its own partition and its own risk score)
or by adding a deliberate `ignore.txt` entry.

The script also prints the **deep-dive cut line** — which partitions fell below
`top_n` and how many source files they hold. A budget decision is legitimate; an
*invisible* budget decision is how a partition ranked #9 against a default
`top_n: 8` quietly became inventory-only. Read the cut line before proceeding: if
an inventory-only partition holds request handlers, raise `top_n`. Phase 2 §2.13
will additionally promote it on surface evidence, but that is a backstop, not a
substitute for looking.

Then write `phase-01.done`.

Report to the user:
> Phase 1 complete — <N> partitions identified, <K> at full depth. Top risk:
> <partition id> (score <x>/9, <rationale>).

## 1.6 — Edge Cases

- **Empty repo** — if `profile.repo.loc_total < 100`, set partitions to a
  single entry with risk 0 and mark the whole audit degraded.
- **No git history** — fall back age to 0 for every partition.
- **Overlapping globs** — if two partitions' `paths_included` overlap, the
  earlier (higher-risk) partition wins for downstream phase 5; record the
  overlap in `notes[]` on both partitions.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/partitions.json  \
  && test -f .claude-audit/current/phase-01-coverage.json \
  && test -f .claude-audit/current/phase-01.done \
  && echo "phase-01 verified" \
  || { echo "phase-01 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-01 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
