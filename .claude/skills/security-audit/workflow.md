# /security-audit — Orchestrator Workflow (v2)

**Your role.** You are the orchestrator for a comprehensive, multi-phase
security audit. You are a senior application security engineer running a
pre-pentest audit against the user's codebase. You are methodical,
inventory-driven, and you enumerate exhaustively rather than sample.

**Core principle.** Findings beat speed. Discovery beats sampling. Disk beats
context. Every phase writes its output to `.claude-audit/current/` so you stay
lean and sub-agents have a stable contract to read from.

**Authoritative spec.** `docs/V2-SCOPE.md` in the skill repo (check it in at
every commit). This workflow implements it.

---

## Machine-readable contract

The per-phase artifact contract — what each phase must produce, what
sub-agent fan-out it requires, what gate conditions apply — lives in
`manifest.yaml` in this skill directory. That file is authoritative for
downstream tooling (E2E assertion suite, CI checks). This workflow + the
per-step files are authoritative for your behavior as the orchestrator.
When they disagree, fix the discrepancy; do not silently pick one.

## ⚠ MANDATORY ARTIFACT CONTRACT — READ FIRST

A `/security-audit` run is **only valid** when it produces, on disk, all of:

- `.claude-audit/current/phase-00-profile.json` … `phase-08-baseline.json` (at minimum the phases your mode runs)
- `.claude-audit/current/phase-NN.done` markers for every completed phase
- `.claude-audit/current/findings.sarif` (SARIF 2.1.0)
- `.claude-audit/current/findings.cyclonedx.json`
- `<output_dir>/security-audit-report.md` (default `docs/security-audit-output/`; the human report — but NEVER as the only output). See [lib/output-routing.md](lib/output-routing.md).

**Producing only the human report is INVALID.** You will be tempted to
short-circuit when you see Juice Shop / a small repo / a tight time
budget — *do not*. The blackboard artifacts are how delta mode, SARIF
upload, baseline diffing, and PR-gating CI integrations actually work.
A report with no artifacts is a regression to v1.

**Verification rule for every phase:** before you say "Phase N done"
and move on, run `ls .claude-audit/current/phase-NN-*.json
.claude-audit/current/phase-NN.done` and confirm both files exist.
If either is missing, you have NOT completed the phase — go back and
write them.

**First action — execute literally as your first Bash tool call:**

```bash
set -e
mkdir -p .claude-audit/current/phase-04-scanners .claude-audit/cache .claude-audit/history
SKILL_DIR=""
SKILL_VERSION=""
COPILOT_ROOT="${COPILOT_HOME:-$HOME/.copilot}"
if [ -n "${AUDIT_SKILL_DIR:-}" ]; then
  set -- "$AUDIT_SKILL_DIR"
else
  set -- \
    "$HOME/.claude/skills/security-audit" \
    "$COPILOT_ROOT/skills/security-audit" \
    "$HOME/.agents/skills/security-audit" \
    "./.claude/skills/security-audit" \
    "./.github/skills/security-audit" \
    "./.agents/skills/security-audit" \
    "./skills/security-audit"
fi
for p in "$@"; do
  if [ -d "$p" ]; then
    for required in VERSION SKILL.md workflow.md manifest.yaml; do
      if [ ! -f "$p/$required" ]; then
        echo "ERROR: incomplete security-audit installation at $p ($required missing)" >&2
        exit 1
      fi
    done
    candidate_version=$(tr -d '[:space:]' < "$p/VERSION")
    if [ -z "$SKILL_DIR" ]; then
      SKILL_DIR=$(cd "$p" && pwd -P)
      SKILL_VERSION="$candidate_version"
    elif [ "$candidate_version" != "$SKILL_VERSION" ]; then
      echo "WARN: security-audit is installed at different versions: active $SKILL_DIR=$SKILL_VERSION, shadowed $p=$candidate_version" >&2
      echo "WARN: the active (first-match) copy wins. Remove the stale copy or set AUDIT_SKILL_DIR to select explicitly." >&2
    fi
  fi
done
if [ -z "$SKILL_DIR" ]; then
  echo "ERROR: security-audit skill not found in a Claude, Copilot, Agent Skills, or in-repo location" >&2
  exit 1
fi
printf '%s\n' "$SKILL_DIR" > .claude-audit/.skill-dir
if [ ! -f "$SKILL_DIR/VERSION" ]; then
  echo "ERROR: VERSION file missing at $SKILL_DIR/VERSION — install is incomplete" >&2
  exit 1
fi
cat "$SKILL_DIR/VERSION"
```

`set -e` makes any command failure abort the chain — replacing the
fragile `&& \` sequence from earlier rounds. Each step's failure
produces a specific error message instead of a silent non-zero exit.

The probe accepts the canonical personal and project locations for both
harnesses: `$HOME/.claude/skills/security-audit`,
`${COPILOT_HOME:-$HOME/.copilot}/skills/security-audit`,
`$HOME/.agents/skills/security-audit`, `.claude/skills/security-audit`,
`.github/skills/security-audit`, `.agents/skills/security-audit`, then the
in-repo development path. `AUDIT_SKILL_DIR` overrides discovery when an
operator intentionally keeps multiple versions installed. Without that
override, discovering different versions is a hard error rather than silently
running workflow resources from a stale copy. We use `cd && pwd -P` instead of
`realpath` because it is portable across distros without coreutils.

The resolved path is written as a single bare path to
`.claude-audit/.skill-dir` (no `KEY=value`, no shell-source). Later
phases read it as data, never as code.

**Resolving `$SKILL_DIR` in later phases.** Agent harness shell tool calls can
start fresh shells, so environment variables do NOT reliably survive across
invocations. Therefore **every** Bash command that references
`$SKILL_DIR` must re-load it from disk at the top of the same Bash
invocation:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved (preflight didn't run?)"; exit 1; }
python3 "$SKILL_DIR/lib/validate-findings.py" ...
```

The `[ -n "$SKILL_DIR" ]` guard catches the case where `.skill-dir`
exists but is empty — without it, an empty SKILL_DIR causes path
collapse (`"" + "/lib/..." = "/lib/..."`) which is silently wrong.

Do NOT `source` or `.` the file — it is data, not shell code. Reading
it with `cat` cannot trigger code execution if the file is later
tampered with.

**Substituting `$SKILL_DIR` into sub-agent prompts.** When invoking the active
harness's sub-agent primitive with a prompt rendered from
`templates/subagent-prompt.md`, substitute `{{skill_dir}}` with the *literal
absolute path* you just resolved (not the string `$SKILL_DIR`). The
sub-agent's prompt should contain the actual path so its own Bash invocations
work without re-discovery.

After this command succeeds, you may proceed to the rest of this file.

---

## 0. Invocation

The user may pass arguments after `/security-audit`:

| Form | Meaning |
|---|---|
| `/security-audit` | Full audit, default mode. |
| `/security-audit mode: delta` | Delta mode — requires a prior baseline (resolved per [lib/output-routing.md](lib/output-routing.md): default `docs/security-audit-output/security-audit-baseline.json`, legacy `docs/security-audit-baseline.json`). |
| `/security-audit scope: "services/api"` | Scope all phases to the path prefix. |
| `/security-audit categories: "crypto,mitm,secret_sprawl"` | Run only the named deep-dive categories. |
| `/security-audit mode: report` | Re-emit the report from existing `.claude-audit/current/` artifacts. |
| `/security-audit top_n: 12` | Override the top-N partitions that get full-depth deep dives (default: 8). |
| `/security-audit output: reports/sec` | Where to write deliverables (report, SARIF, SBOM, pruned baseline). Default `docs/security-audit-output/`. See [lib/output-routing.md](lib/output-routing.md). |

Canonical form is `key: value` separated by spaces. If the user's phrasing is
ambiguous, ask once for clarification before starting — do not guess.

### Argument parsing

At preflight, parse each `key: value` pair into an invocation dict:

```python
invocation = {
  "mode":      "full",     # full|delta|scoped|focused|report
  "scope":     None,       # string | None
  "categories": None,      # list[str] | None
  "top_n":     8,          # int; override for partition deep-dive cap
}
```

Unknown keys → warn and stop (do not silently ignore). The parsed
`top_n` is passed to `steps/phase-01-partition.md §1.4`. The parsed
`categories` list is passed to `steps/phase-05-deepdives.md §5.2` to
gate the fan-out.

### Category-name aliases

The following short aliases are accepted as equivalents to the internal
category names (applied during `categories:` parsing):

| Alias | Canonical |
|---|---|
| `auth` | `auth` |
| `authz` | `auth` |
| `idor` | `idor` |
| `bola` | `idor` |
| `token` | `token_scope` |
| `tokens` | `token_scope` |
| `scope` | `token_scope` |
| `mitm` | `mitm` |
| `transport` | `mitm` |
| `tls` | `mitm` |
| `crypto` | `crypto` |
| `cryptography` | `crypto` |
| `secrets` | `secret_sprawl` |
| `secret` | `secret_sprawl` |
| `secret_sprawl` | `secret_sprawl` |
| `deploy` | `deployment` |
| `deployment` | `deployment` |
| `injection` | `injection` |
| `ssrf` | `injection` |
| `deserialize` | `injection` |
| `llm` | `llm` |
| `ai` | `llm` |
| `supply_chain` | `supply_chain` |
| `supply-chain` | `supply_chain` |
| `supplychain` | `supply_chain` |
| `sca` | `supply_chain` |
| `cicd` | `supply_chain` |
| `agentic` | `agentic` |
| `mcp` | `agentic` |
| `agent` | `agentic` |
| `collection_scope` | `collection_scope` |
| `collection` | `collection_scope` |
| `collections` | `collection_scope` |
| `list` | `collection_scope` |
| `row_scope` | `collection_scope` |

Aliases are case-insensitive. Unknown tokens → warn and stop.

## 1. Preflight

Before any phase runs:

1. **Version.** Read `skills/security-audit/VERSION`. Stamp this into every
   artifact under `.claude-audit/current/` as `skill_version`.
2. **Blackboard.** Ensure `.claude-audit/` exists at the project root (the
   skill-user's project, not this skill's own repo). Layout:
   ```
   .claude-audit/
     current/            # this run's in-progress artifacts
     baseline.json       # full baseline (delta-mode input)
     ignore.txt          # ignore patterns (generated Phase 0)
     cache/              # cross-phase caches (keystone files, handler hashes)
     history/<ts>/       # prior runs archived here on new-run rotation
     audit.log           # orchestrator log (append-only)
   ```
   If `current/` already exists and is non-empty, rotate it to
   `history/<ISO-8601-timestamp>/` first.
3. **Preflight scanners (Phase 4 prerequisite).** Probe for the required
   binaries (`semgrep osv-scanner gitleaks trufflehog trivy hadolint`) via
   `which`. For any missing tool, print a one-line warning naming the tool and
   the install hint (`scripts/install-scanners.sh`), then **continue in
   degraded mode**. Never hard-fail preflight.
4. **Gitignore hygiene.** If `.claude-audit/` is not in the user's
   `.gitignore`, append it and commit a message to the user reporting the
   addition. This covers the blackboard only — `<output_dir>` is not resolved
   yet at this point and gets its own hygiene step in §3.5, which is where the
   v2.6.0 leak actually landed.

## 2. Phase Plan

| # | Phase | Instruction file | Output artifact |
|---|---|---|---|
| 0 | Discovery & Recon | `steps/phase-00-discovery.md` | `phase-00-profile.json` |
| 1 | Partition & Risk Rank | `steps/phase-01-partition.md` | `partitions.json`, `phase-01-coverage.json` |
| 2 | Attack Surface Inventory | `steps/phase-02-surface.md` | `phase-02-surface.json`, `phase-02-sinks.json`, `phase-02-credentials.json`, `phase-02-collections.json` |
| 3 | Keystone File Index | `steps/phase-03-keystone.md` | `cache/keystone-files.json` |
| 4 | External Inputs (scanners) | `steps/phase-04-scanners.md` | `phase-04-scanners/*.sarif` |
| 5 | Parallel Deep Dives (12 cat) | `steps/phase-05-deepdives.md` | `phase-05-<cat>-<partition>.jsonl` |
| 6 | Config + Methodology Spine | `steps/phase-06-config.md` | `phase-06-config.json`, `asvs.jsonl` |
| 7 | Synthesis & Report | `steps/phase-07-synthesis.md` | `phase-07-report.md`, `findings.sarif`, `phase-07-severity-gate.json` |
| 8 | Baseline Persistence | `steps/phase-08-baseline.md` | `baseline.json`, `<output_dir>/security-audit-baseline.json` |

Phases beyond M1 are tracked as **not yet implemented** until their
milestone lands. When you reach an unimplemented phase in a development build,
emit a `phase-NN.pending` marker into `.claude-audit/current/` and report
graceful degradation to the user.

## 3. Saga Checkpointing — MANDATORY per phase

After each phase produces its artifact, write a `phase-NN.done` marker into
`.claude-audit/current/`. On resume, scan markers to determine the restart
point. Delta mode treats a `phase-NN.done` marker plus a matching baseline as
sufficient to skip the phase.

**At every phase boundary, run this verification block:**

```bash
# Replace NN with the just-completed phase number.
test -f .claude-audit/current/phase-NN-*.json && \
test -f .claude-audit/current/phase-NN.done && \
echo "phase-NN: artifact + marker present" || \
{ echo "phase-NN: MISSING artifact or marker — phase incomplete, do not advance"; exit 1; }
```

Treat any failure of this check as a hard stop. **Do not advance to
phase N+1 without proof on disk that phase N produced what it owes.**
This is the single most common way previous runs degraded into
"report-only" output that broke delta mode.

## 3.5 Resolve the output directory (preflight, before Phase 0)

Immediately after the blackboard preflight, resolve `output_dir` following
[lib/output-routing.md](lib/output-routing.md) (first match wins):

1. `output:` arg, if given.
2. `.claude-audit/config.json` `.output_dir`, if a prior run set it.
3. **Ask the user** (one question) — ONLY when interactive: `[ -t 0 ]`, `$CI`
   unset, `$AUDIT_NONINTERACTIVE` not `1`, and not
   `--dangerously-skip-permissions` /
   `$CLAUDE_CODE_DANGEROUSLY_SKIP_PERMISSIONS`. `AUDIT_NONINTERACTIVE=1` is the
   harness-neutral signal used by headless Claude and Copilot runners. Default offered:
   `docs/security-audit-output/`.
4. Otherwise default to `docs/security-audit-output/` (log it; never block).

Then persist it: merge `{"output_dir": "<resolved>"}` into
`.claude-audit/config.json`. All later references to `<output_dir>` use this
value. Deliverables are written to `<output_dir>/` as the final step of
Phase 7 / Phase 8, AFTER the canonical `.claude-audit/current/` copies exist
(blackboard-first).

### 3.5b Gitignore hygiene for `<output_dir>` (v2.6.1)

Once `output_dir` is resolved, apply the machine-artifact ignore recipe from
[lib/output-routing.md](lib/output-routing.md) if it is not already present:

```bash
# Same defensive form as §7.10 and §8.4. Without the fallback, a missing
# config.json makes jq print its error to stdout and the printf below writes
# that error text into .gitignore as an ignore pattern -- so the recipe silently
# never applies.
OUT=$(jq -r '.output_dir // "docs/security-audit-output"' .claude-audit/config.json 2>/dev/null || echo docs/security-audit-output)
[ -n "$OUT" ] || OUT=docs/security-audit-output
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git check-ignore -q "$OUT/findings.sarif" || {
    printf '\n# claude-security-audit: machine artifacts (v2.6.1)\n%s/*.sarif\n%s/*.cyclonedx.json\n' "$OUT" "$OUT" >> .gitignore
    echo "Added $OUT/*.sarif and $OUT/*.cyclonedx.json to .gitignore"
  }
fi
```

Report the addition to the user; do not do it silently.

**Why this step exists.** §1 step 4 has gitignored `.claude-audit/` since v2.1,
and `<output_dir>` — the directory whose entire purpose is to be committed —
had no equivalent. Through v2.6.0 the consolidated `findings.sarif` carried
gitleaks' verbatim `region.snippet.text`, so the audit committed live
credentials that the audited repo had correctly kept untracked. `§4.4b` now
strips them at ingest and `lib/verify-deliverable.py` gates the write, so this
step is defence in depth rather than the fix. It is still worth doing: the
machine artifacts are bulky, churn every run, and nobody reviews them in a PR.

The human report and the pruned baseline stay **tracked** deliberately — a
committed baseline is what makes `mode: delta` work on a fresh clone with no
arguments (`lib/output-routing.md`), and both are gated before they are
written.

## 4. Mode-Specific Orchestration

### full
Run phases 0→8 in order. Fan-out Phase 5 per §5 below.

### delta

Delta mode prerequisites, enforced as a preflight gate (before Phase 0 runs):

1. **Baseline presence.** The pruned baseline (resolved per
   [lib/output-routing.md](lib/output-routing.md): `output:` arg →
   `.claude-audit/config.json` → `docs/security-audit-output/security-audit-baseline.json`
   → legacy `docs/security-audit-baseline.json`) AND `.claude-audit/baseline.json`
   must both exist. If either is missing, abort with: *"Delta mode requires a
   baseline. Run `/security-audit` in full mode first, then retry."*

2. **Baseline age — MUST enforce in code, not prose.** Compute:
   ```bash
   created=$(jq -r .created_at .claude-audit/baseline.json)
   age_days=$(python3 -c "
   from datetime import datetime, timezone
   d = datetime.fromisoformat('$created'.replace('Z','+00:00'))
   print((datetime.now(timezone.utc) - d).days)
   ")
   if [ "$age_days" -gt 90 ]; then
     # Warn; require explicit --force-stale-baseline to proceed.
     # Without the flag, abort with a message citing created_at + age.
     exit 1
   fi
   ```
   The 90-day floor is a hard gate, not advisory. Ecosystem
   vulnerability databases (OSV, semgrep rules, trivy DB) update
   continuously; a baseline older than 90 days risks skipping newly-
   published CVEs that a delta-mode run would silently carry over.

3. **Baseline reachability.** Run `git merge-base --is-ancestor
   <baseline.git_head> HEAD`. If non-zero, abort: the baseline's commit
   is no longer in local history.

4. **Changed-files enumeration.** `ChangedFiles = git diff --name-only
   <baseline.git_head> HEAD`, filtered through `baseline.ignored`.

5. Apply the invalidation algorithm in `lib/delta-mode.md` §2-3.

6. Re-run Phases 2-7 only for touched partitions.

7. Carry forward non-touched findings with `source: baseline`.

8. Emit a **Delta Summary** preamble in the Phase 7 report showing:
   baseline date, baseline commit SHA, current HEAD, changed-file count,
   touched-partition count, carryover count, new-finding count,
   fixed-since-baseline count.

The user may override the staleness gate with `--force-stale-baseline`,
in which case the skill records the override in `audit.log` and in the
report's provenance section.

### scoped
Narrow every phase's glob / Grep to the path prefix.

### focused
Phase 0 and 1 still run (they are cheap and required context). Phase 5 runs
only the named categories.

### report
Skip Phases 0-6. Re-emit from existing `.claude-audit/current/` artifacts.

## 5. Fan-Out Rules (Phase 5 Deep Dives)

**Harness sub-agent adapter.** "Spawn one sub-agent" means use the active
harness's general-purpose sub-agent primitive:

- Claude Code: the Agent tool with `subagent_type: "general-purpose"`.
- GitHub Copilot CLI: the task/subagent tool with
  `agent_type: "general-purpose"`.

Do not collapse fan-out when a tool is named differently. If the active
harness has no writable general-purpose sub-agent primitive, halt Phase 5 and
report the unsupported runtime rather than synthesizing categories in the
orchestrator. Use the harness's high-capability general-purpose model. Do not
force a Claude model ID through Copilot, and do not select a lightweight model.

For each top-N partition × each deep-dive category:
- Spawn **one sub-agent** using the template at `templates/subagent-prompt.md`.
- Model: the harness's high-capability general-purpose default. **Never
  downgrade to a lightweight model.**
- **Orchestrator-side re-validation (defense in depth).** After the
  sub-agent returns, the orchestrator re-runs
  After loading `SKILL_DIR=$(cat .claude-audit/.skill-dir)`, run:
  `python3 "$SKILL_DIR/lib/validate-findings.py" --schema "$SKILL_DIR/lib/finding-schema.json"
  --cwe-map "$SKILL_DIR/lib/cwe-map.json"
  --require-capabilities auth,idor,token_scope,collection_scope <artifact>`
  against the emitted JSONL.
  The sub-agent is *told* to validate before returning; the
  orchestrator's re-run catches cases where the sub-agent skipped
  the self-check. Validation failure triggers one retry with the
  errors quoted back at the sub-agent; second failure records a
  placeholder INFO finding and proceeds.

  **Honest caveat.** The orchestrator is itself an LLM following
  `workflow.md`. Nothing *forces* the orchestrator to run the
  validator either — an uncooperative or distracted orchestrator
  could skip the step and return success. This is a fundamental
  property of prompt-driven systems, not a bug fixable with more
  text. The CI workflow (`.github/workflows/ci.yml`) is the only
  runtime-enforced validation; it runs against `tests/fixtures/`, not
  against live-audit artifacts. Users who need cryptographic
  enforcement should wrap sub-agent invocations in a harness that
  runs the validator as a hard post-condition.

### File-locking / concurrent writes

Phase 5's artifact-path convention
(`phase-05-<category>-<partition>.jsonl`) makes collisions unlikely
by naming. The orchestrator does not rely on file locking: the
concurrency cap (8 sub-agents) combined with unique per-(category,
partition) paths keeps writes disjoint. If a future change raises
the concurrency cap or permits multiple sub-agents on the same
(category, partition) pair, file-locking needs to be added
explicitly — *do not* assume the convention protects it.

### Needs-recursion split procedure

If a sub-agent returns `{"status": "needs_recursion", "suggested_split": [...]}`:

1. The orchestrator marks the original partition `deferred`.
2. For each entry in `suggested_split`, create a new sub-partition:
   - `id` = suggested id (prefix-disambiguate if collides with an
     existing partition).
   - `path` = longest common prefix of `paths_included`.
   - `paths_included` = as suggested.
   - Risk score: inherit from the parent partition.
   - `depth` = parent's depth.
3. Re-fan-out for each sub-partition × category.
4. Merge findings from sub-partitions back under the parent partition
   id at Phase 7 synthesis — so final reports reference the *original*
   partition, not the sub-split internal detail.
5. **Recursion floor.** Do not recurse more than 2 levels deep.
   A sub-sub-partition that still needs_recursion gets a placeholder
   INFO finding noting the scope was unreachable.
- **Runtime-resolved model capability.** Use the harness's high-capability
  general-purpose model without hardcoding a provider-specific model ID. The
  500K soft / 800K hard raw-code budgets are upper bounds, not assumptions:
  when the active model's context limit is lower, split early enough to remain
  below that limit. A partition that cannot fit returns `needs_recursion`
  regardless of harness.
- Concurrency cap: **8 sub-agents in flight** (configurable; raise only if
  the runtime handles it).
- Per-subagent token budget: 500K soft / 800K hard raw code. A partition over
  the soft ceiling must return `{"status":"needs_recursion", ...}` so the
  orchestrator splits it further.

Tail partitions (beyond top-N) receive inventory-only treatment: they are
enumerated in Phase 2 but do not get a deep-dive sub-agent per category.

## 6. Reporting Checkpoints to the User

At the **start** of each phase, send one short sentence:
> Phase <N>: <phase name> — starting.

At the **end** of each phase, send one short sentence:
> Phase <N> complete — <N findings | profile written | etc>.

Never echo artifact contents to the user. The final report is the user-facing
artifact; everything else stays on disk.

## 7. Halt Conditions

- **Halt** if no application source code is found. This audit requires a
  codebase to analyze.
- **Halt** if the current working directory is not a git repository. Baseline
  and delta mode require git state.
- **Halt** if `delta` mode is invoked and no baseline exists after offering to
  fall back to `full`.
- **Do not halt** for missing scanners — continue in degraded mode.
- **Do not halt** for unimplemented phases in development builds — write the
  pending marker and continue.

## 8. Final Output

Canonical machine state is always written to the blackboard FIRST:
- `.claude-audit/current/findings.sarif` (SARIF 2.1.0)
- `.claude-audit/current/findings.cyclonedx.json` (SBOM, when scanners can
  produce one).
- `.claude-audit/baseline.json` (full; gitignored)

Then copy the deliverables to the resolved `<output_dir>` (default
`docs/security-audit-output/`, see [lib/output-routing.md](lib/output-routing.md)):
- `<output_dir>/security-audit-report.md` (the human report)
- `<output_dir>/findings.sarif`
- `<output_dir>/findings.cyclonedx.json`
- `<output_dir>/security-audit-baseline.json` (pruned; checked in)

Present a short summary to the user with counts by severity, a pointer to the
report path, and the three next-step options from v1:
1. "fix finding <id>"
2. "fix all CRITICAL and HIGH findings"
3. "create a GitHub issue for this report"
