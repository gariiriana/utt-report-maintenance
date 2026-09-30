# Phase 4 — External Inputs (Scanner Orchestration)

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-04-scanners/*.slim.json` (one per scanner that ran: semgrep, osv-scanner, gitleaks, trufflehog, trivy, hadolint — whichever are installed)
- `.claude-audit/current/phase-04-scanners/security-review-*.md` (Claude Code `/security-review` output)
- `.claude-audit/current/phase-04-scanners/adversarial-*.md` (adversarial-review sub-agent output)
- `.claude-audit/current/phase-04.done`

🔁 **Scanner invocation has TWO supported paths** (Path A = host binaries, Path B = container wrapper). For each scanner, follow the precedence chain in §4.1.5. **Don't assume PATH is the only source.**

⛔ **DO NOT advance to Phase 5** until the scanner directory has at least one `slim.json` AND the Verify block prints `phase-04 verified`. Missing scanner binaries are NOT fatal — degrade gracefully, but still emit the marker after the attempt.

📖 Phase 7 synthesis cross-references scanner findings against skill findings to tag CONFIRMED vs LIKELY confidence. No scanner artifacts ⇒ every skill finding drops to LIKELY or POSSIBLE.

---

**Goal.** Run the standardized scanner bundle + Claude Code's built-in
reviews in parallel. Emit SARIF per scanner for later cross-referencing.
Never hard-fail: any missing scanner becomes a degraded-mode warning.

**Inputs.**
- `.claude-audit/current/phase-00-profile.json` — gates conditional scanners
- `.claude-audit/current/partitions.json` — bounds per-partition reviews

**Outputs.**
- `.claude-audit/current/phase-04-scanners/<tool>.sarif` (raw SARIF per tool)
- `.claude-audit/current/phase-04-scanners/<tool>.slim.json` (post-processed)
- `.claude-audit/current/phase-04-scanners/summary.json` (tool status, counts)
- `.claude-audit/current/phase-04-scanners/security-review-<partition>.md`
  (one per partition — built-in `/security-review` output)
- `.claude-audit/current/phase-04-scanners/adversarial-<partition>.md` (one
  per partition — vendored adversarial-review output)
- `.claude-audit/current/phase-04.done` (saga marker)

---

## 4.1 — Preflight

Build two lists by probing in this order:

1. **`present_path`**: scanners detected via `command -v <scanner>` on
   the host's `PATH`.
2. **`present_container`**: scanners reachable through the Path B
   wrapper. The wrapper lives at `$AUDIT_SKILL_REPO/scripts/run-audit-in-container.sh`,
   where `$AUDIT_SKILL_REPO` is set by the user (typically points at
   their cloned `claude-security-audit` repo). If the env var is
   unset, fall back to these probe paths in order:
   - `~/Code/claude-security-audit/scripts/run-audit-in-container.sh`
   - `~/projects/claude-security-audit/scripts/run-audit-in-container.sh`
   - `./scripts/run-audit-in-container.sh` (in case the audit target
     IS the skill repo — dogfood case)
   The wrapper is "present" if its file exists AND a container
   runtime (`podman` or `docker`) is on PATH.

If `$AUDIT_FORCE_PATH_B` is set to `1` in the environment, skip the
PATH probe entirely and use the wrapper for every scanner. The E2E
harness sets this when running `--path-b` so it can validate the
container path without uninstalling host scanners.

3. **`missing`**: scanners in the required/conditional set found in
   neither list.

For every missing required scanner, append one line to the audit log:

> Scanner `<name>` missing on PATH and no wrapper available. Install
> with `scripts/install-scanners.sh` (Path A) or build the Path B
> container with `scripts/run-audit-in-container.sh --build`.
> Degraded mode: skipping this scanner.

**Do not halt.** Proceed with whatever is reachable.

## 4.1.5 — Scanner invocation precedence

For each required scanner, the orchestrator picks ONE invocation
method per the precedence below. Once chosen, all extra args
documented in §4.2's table are appended.

1. **Path A (host PATH binary).** If `command -v <scanner>` succeeds
   AND `$AUDIT_FORCE_PATH_B != 1`, invoke the binary directly per
   §4.2's table. Output goes to
   `.claude-audit/current/phase-04-scanners/<tool>.sarif` (orchestrator
   sets `--output` / `-o` / equivalent).

2. **Path B (container wrapper).** If Path A is unavailable OR
   `$AUDIT_FORCE_PATH_B == 1`, invoke
   `bash $WRAPPER_PATH scan <tool>` where `$WRAPPER_PATH` was
   resolved in §4.1. The wrapper writes to the same
   `.claude-audit/current/phase-04-scanners/<tool>.sarif` path
   (the bind-mount makes them the same file on host disk).

3. **Skip with warning.** If neither path is available, append a
   `{tool, reason}` row to `phase-04-scanners/skipped.json` and
   continue. Do not fail.

Log the chosen invocation method per scanner in `summary.json`
(field: `invocation: "path_a" | "path_b" | "skipped"`) so Phase 7
synthesis can report it and a future delta-mode run can detect
when the user has switched paths.

## 4.2 — Required scanner bundle

Run these six in parallel (max 4 concurrent — scanners are heavy I/O):

| Tool | Invocation | Notes |
|---|---|---|
| **semgrep** | `semgrep scan --config p/security-audit --config p/owasp-top-ten --config p/jwt --sarif --output phase-04-scanners/semgrep.sarif --timeout 600 --metrics=off` | Uses named community rulesets (no telemetry). `--config auto` is the alternate path — it gives broader coverage but requires `--metrics=on`. The skill opts out of metrics by default (per Q4 no-telemetry decision). **Offline / air-gapped:** if `AUDIT_SAST_RULES` is set, replace the `--config p/...` packs with `--config "$AUDIT_SAST_RULES"` (a locally-staged rules dir) — fully offline, no registry fetch (see `lib/scanner-bundle.md`). |
| **osv-scanner** | `osv-scanner scan --recursive --format sarif --output phase-04-scanners/osv.sarif .` | Ecosystem auto-detected from manifests. Skipped if no lockfiles present — warn, do not fail. |
| **gitleaks (working tree)** | `gitleaks detect --no-git --report-format sarif --report-path phase-04-scanners/gitleaks.sarif` | Fast — scans the checked-out tree only. `--no-git` deliberately ignores `.gitignore`, so this output carries secrets the repo correctly never committed. ⚠ **Its SARIF holds the matched secret verbatim in `region.snippet.text` — §4.4b is mandatory before anything reads it.** |
| **gitleaks (git history)** | `gitleaks git . --report-format sarif --report-path phase-04-scanners/gitleaks-history.sarif` | Slow; separate sub-agent with 20 min timeout. Non-blocking for Phase 7 synthesis. |
| **trufflehog** | `trufflehog git file://. --json --results=verified > phase-04-scanners/trufflehog.json` | Emits JSONL, not SARIF; convert in §4.5. (`--only-verified` is soft-deprecated → `--results=verified`.) ⚠ **`verified` means the scanner proved the credential is live. `Raw`/`RawV2`/`Redacted` hold it — §4.4b is mandatory.** |
| **trivy** | `trivy fs --scanners vuln,secret,misconfig,license --format sarif --output phase-04-scanners/trivy.sarif .` | Also run `trivy config -f sarif -o trivy-iac.sarif .` if IaC files detected. |
| **hadolint** | `for f in $(find . -name Dockerfile -not -path ./node_modules/*); do hadolint --format sarif "$f"; done > phase-04-scanners/hadolint.sarif` | Conditional: only if `Dockerfile*` present. |

### Invocation shell (reference)

Each scanner runs via one sub-agent using the template (`templates/subagent-prompt.md`) with `{{phase-specific-method-body}}` = "Bash the invocation above, then validate SARIF parses with `jq -e .runs .`". The sub-agent returns `{ tool, exit_code, sarif_path, finding_count, notes }`.

Keep the orchestrator out of the scanner process memory; only JSON summary returns.

## 4.3 — Conditional adds

Gate on `phase-00-profile.json`:

| Scanner | Gate condition |
|---|---|
| **brakeman** | `frameworks[*].framework` contains `Rails` |
| **checkov** | `deployment.iac.terraform` is non-empty |
| **kube-linter** | `deployment.k8s.manifests` or `.helm_charts` non-empty |
| **grype** | `deployment.docker.dockerfiles` non-empty OR any lockfile present (EPSS + CISA-KEV prioritization). Emit BOTH `grype dir:. -o sarif > grype.sarif` and `grype dir:. -o json > grype.json`; Phase 7 joins EPSS/KEV onto findings (see `lib/scanner-bundle.md`). |
| **govulncheck** | `languages[*].name` contains `Go` |
| **psalm** (`--taint-analysis`) | `languages[*].name` contains `PHP` |
| **zizmor** | `.github/workflows/*.yml` present |

Invocation per conditional scanner documented in `lib/scanner-bundle.md`.

## 4.4 — Claude Code built-in reviews per partition

**`/security-review`** — run once per partition whose `depth: full`. The
built-in review skill is designed for diffs; we adapt by passing the
partition's scope hint. Execute via a sub-agent with:

```
TASK: Invoke /security-review on files under <partition.paths_included>.
SCOPE: limit the review to the partition path prefix.
OUTPUT: save the Markdown findings list to
  .claude-audit/current/phase-04-scanners/security-review-<partition-id>.md
```

If the partition is above 500K raw tokens, fall back to sampling: sub-agent
returns `needs_recursion` suggesting the split.

**Vendored adversarial-review** — run once per partition whose `depth: full`.
Execute via a sub-agent that reads
`skills/security-audit/vendored/adversarial-review/SKILL.md` and applies it
with scope hint. Save to
`phase-04-scanners/adversarial-<partition-id>.md`.

## 4.4b — Redact scanner output at ingest (MANDATORY, blocking)

⛔ **Run this before §4.5, before §4.6, and before any sub-agent, phase, or
`cp` reads `phase-04-scanners/`. It is not an optional hardening step; skipping
it reintroduces CVE-class behaviour in the skill itself.**

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
OUT=$(jq -r '.output_dir // "docs/security-audit-output"' .claude-audit/config.json 2>/dev/null || echo docs/security-audit-output)
# Write to a temp file and move it into place only on success. A bare `>`
# redirect truncates the target BEFORE the command runs, so a failed redaction
# left an empty phase-04-redaction.json that satisfied the manifest's existence
# check while §4.4c had nothing to read.
python3 "$SKILL_DIR/lib/redact-scanner-output.py" --output-dir "$OUT" \
    .claude-audit/current/phase-04-scanners/ \
    > .claude-audit/current/phase-04-redaction.json.tmp \
  && mv .claude-audit/current/phase-04-redaction.json.tmp \
        .claude-audit/current/phase-04-redaction.json \
  || { echo "FATAL: scanner redaction failed; see stderr above" >&2
       rm -f .claude-audit/current/phase-04-redaction.json.tmp
       exit 1; }
```

Then confirm it held — the check must exit 0:

```bash
SKILL_DIR=$(cat .claude-audit/.skill-dir)
[ -n "$SKILL_DIR" ] || { echo "ERROR: SKILL_DIR not resolved"; exit 1; }
python3 "$SKILL_DIR/lib/redact-scanner-output.py" --check --quiet \
    .claude-audit/current/phase-04-scanners/ || {
      echo "FATAL: scanner output still carries credential material" >&2; exit 1; }
```

`phase-04-redaction.json` is a required Phase 4 artifact (`manifest.yaml`). It
carries the redaction counts and the `self_leak_candidates[]` list that §4.4c
consumes.

It covers **every** declared output of this phase, not only the JSON formats:
`security-review-*.md` and `adversarial-*.md` are LLM prose *about* the secrets
that were found, and they are scrubbed by the pattern pass rather than the
structural strip.

### Why this exists

Through v2.6.0 the skill wrote live credentials into the repository it was
auditing. Four links, each working as specified:

1. `gitleaks detect --no-git` ignores `.gitignore` — correctly, because that is
   where uncommitted secrets live — and its SARIF carries the match verbatim in
   `region.snippet.text`.
2. `phase-07-synthesis.md §7.8.1` assembles `findings.sarif` as one run per
   scanner plus one synthetic run, and instructs that per-scanner runs be
   "copied through *verbatim*".
3. `§7.10` copies that document to `<output_dir>`.
4. `lib/output-routing.md` defaults `<output_dir>` to
   `docs/security-audit-output/` and calls it "tracked".

A token that the audited project had correctly kept **out** of git was read
from a gitignored path and committed — by the audit. Meanwhile `workflow.md §1`
gitignored `.claude-audit/` and never `<output_dir>`: the protection sat on the
working directory, not the one that gets committed.

### What the redactor does, and what it costs

It removes SARIF `snippet` / `contents` / `insertedContent` from **every**
scanner run unconditionally — not just the secret scanners, and not by matching
credential patterns. Nothing downstream reads those fields: `lib/sarif-postprocess.md`
discards them when slimming, Phases 5-7 read only the slim form, and
`tests/e2e/assertions.py:_sarif_result_to_finding` keys on `ruleId`,
`properties.cwe`, `properties.cwes` and `tags`. Removing a field no consumer
reads cannot lose coverage, and needs no detector list to stay complete.

Each result keeps `ruleId`, `level`, `message`, file and line, and gains
`properties.secret_fingerprint` — stable across runs for the same secret, so
Phase 7 still dedupes and Phase 8 still carries the finding forward in the
baseline. What triage loses is the ability to eyeball the matched string. That
is the trade, and it is the right one: no triage step in this skill requires
reading a live credential.

A pattern pass (`lib/secret-detectors.py`) then covers the free text the
structural strip cannot reach — scanner `message.text`, invocation command
lines, trufflehog `ExtraData`.

## 4.4c — Hits inside a previous audit's own artifacts are NOT noise

Scanners run over the whole working tree, which includes `<output_dir>/` and
`.claude-audit/history/` from earlier runs. Pre-v2.6.1 artifacts can contain
real credentials.

⛔ **Do not add the audit's own output to an ignore list and move on.** That
triage is how this defect survived two separate runs that detected it: the hits
were dismissed as prior-artifact noise, and the reasoning was self-confirming —
of course the audit's own output has secret hits, it is a security report.

`redact-scanner-output.py --output-dir "$OUT"` computes this list for you:
read `self_leak_candidates[]` from `phase-04-redaction.json`. It is an artifact
rather than a judgement call precisely because the judgement call has been made
wrongly twice, each time with a plausible story attached.

For every row in `self_leak_candidates[]` (equivalently: any secret-scanner hit
under `<output_dir>/`, `.claude-audit/`, or a legacy `docs/security-audit-*`
path):

- Emit it as **CRITICAL** / CWE-538 / `category: secret_sprawl`, titled to name
  the cause — *"prior audit run wrote credential material into the repository"*.
- Set the finding's `skill_self_leak` field to `"true"` (see
  `lib/finding-schema.json`). Phase 7 carries it to the SARIF result as
  `properties.skill_self_leak`. It exists so these rows never aggregate with
  findings about the user's own code, and so the triage call is greppable
  rather than implicit.
- **State the matched length before claiming the credential leaked.** Every
  redaction marker carries `len<N>`, and `self_leak_candidates[]` rows come from
  a scanner match, not from a full-value comparison. A short match is often a
  *prefix* that a document quotes deliberately (`gho_` plus seven characters in
  a planning note is a reference, not a credential). Write "an 11-character
  prefix of a GitHub OAuth token" when that is what the evidence supports, and
  "the full 40-character token" only when the length says so. Getting this
  backwards turns a tidy-up into a rotation emergency, and it happened on the
  very incident that motivated v2.6.1.
- The `suggested_fix` must be the two-step one, in this order:
  1. **Rotate the credential.** It is live until rotated, and everything below
     is irrelevant until it is done.
  2. **Then purge it from history** (`git filter-repo` / BFG), force-push, and
     tell every collaborator to re-clone.
- The fix text must state explicitly that **untracking is not purging**. A
  `git rm --cached` plus a `.gitignore` line removes the file from `HEAD` and
  leaves the blob and the live credential reachable in history. That exact
  half-fix has been applied to this defect before and read as resolved.

If the *current* run's own gate fires instead, that is a different finding —
see `phase-07-synthesis.md §7.10a`.

## 4.5 — Format normalization

### Trufflehog JSONL → SARIF

Trufflehog emits one JSON object per line (`{source, source_type, raw, ...}`).
Convert to SARIF 2.1.0 minimally:

```json
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "trufflehog" } },
    "results": [ /* one per verified secret */ ]
  }]
}
```

See `lib/sarif-postprocess.md` for the field mapping.

### Hadolint SARIF concatenation

`hadolint --format sarif` emits one SARIF document per Dockerfile. Merge
into a single `runs[]` array (one run per file keeps tool-driver name
consistent; multiple runs is fine).

## 4.6 — Post-process: slim SARIF

For each raw SARIF, produce a slim JSON keeping only the fields needed by
Phase 5-7:

```json
{
  "tool": "semgrep",
  "tool_version": "1.x",
  "results": [
    {
      "rule_id": "python.flask.security.audit.render-template-with-variable",
      "level": "error",
      "file": "app/views.py",
      "start_line": 42,
      "message": "Use of user-controlled template variable..."
    }
  ]
}
```

Discard: full locations beyond file+line, fingerprints, fixes, tags,
artifacts[], invocations[]. This cuts ~80% of SARIF bulk and makes Phase 7
diffing much cheaper. The raw SARIF is kept on disk for users who want to
upload it to GitHub's Security tab directly.

See `lib/sarif-postprocess.md` for the exact field-mapping procedure.

## 4.7 — Summary emission

After all scanners complete (or time out), write
`phase-04-scanners/summary.json`:

```json
{
  "schema_version": 2,
  "skill_version": "...",
  "audit_id": "...",
  "generated_at": "...",
  "scanners": [
    {"name": "semgrep", "status": "ok", "finding_count": 34, "raw_path": "semgrep.sarif", "slim_path": "semgrep.slim.json", "duration_ms": 48000},
    {"name": "osv-scanner", "status": "ok", "finding_count": 12, "raw_path": "osv.sarif", ...},
    {"name": "trivy", "status": "timeout", "finding_count": null, "raw_path": null, "notes": "exceeded 600s"},
    {"name": "hadolint", "status": "skipped", "finding_count": null, "notes": "no Dockerfile detected"}
  ],
  "built_in_reviews": [
    {"kind": "security-review", "partition": "juice-shop", "output": "security-review-juice-shop.md", "finding_count_estimate": 23},
    {"kind": "adversarial", "partition": "juice-shop", "output": "adversarial-juice-shop.md", "finding_count_estimate": 15}
  ]
}
```

Write `phase-04.done`.

## 4.8 — Report to user

> Phase 4 complete — ran <N> scanners, <K> skipped, <T> timed out. Total
> raw findings: <count>. Per-partition built-in reviews: <M>. Slim SARIF
> written to phase-04-scanners/. Proceeding to Phase 5 (deep dives).

## 4.9 — Error handling

- **Scanner returns non-zero but writes valid SARIF**: accept it. Most
  scanners exit non-zero when findings exist.
- **Scanner writes nothing + non-zero exit**: record `status: "error"` with
  the last 500 chars of stderr in `notes`; move on.
- **Scanner hangs**: the sub-agent's own timeout clause kills it;
  orchestrator records `status: "timeout"`.
- **SARIF file parses but has no `runs` key**: record `status: "malformed"`;
  do not include in Phase 7 synthesis.

## 4.10 — Rate-limit safety

The required bundle at 4 concurrent still makes Bash calls, not Claude API
calls, so the Claude rate limits don't apply to scanner invocations
directly. The `/security-review` and `adversarial-review` sub-agents DO
consume API — they are bounded by the orchestrator's 8-concurrent cap for
all sub-agents combined (Phase 4 scanner sub-agents + Phase 4 review
sub-agents + any other concurrent phase).

## 4.11 — Git-history secrets as a long-running side task

Per V2-SCOPE §10.9, `gitleaks git` on a ≥10k-commit repo can take several
minutes. Execute this as a dedicated sub-agent with `timeout 1200` (20 min).
If it times out, mark `status: "timeout"` and **do not block Phase 7** —
Phase 7 synthesis proceeds with whatever finished; gitleaks history
findings merge into the report if they land in time, else they are filed
as a follow-up note.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/phase-04-scanners/summary.json  \
  && test -f .claude-audit/current/phase-04.done \
  && echo "phase-04 verified" \
  || { echo "phase-04 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-04 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
