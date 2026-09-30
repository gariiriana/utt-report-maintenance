# Output Routing

Defines where `/security-audit` writes its **deliverables**. Resolved once in
the workflow preflight (`workflow.md §0.5`) and persisted so `mode: delta` and
`mode: report` reuse the same location. Introduced in v2.1; replaces the v2.0
`_bmad-output/` auto-detect entirely (there is no BMAD coupling anymore).

## Two output classes

1. **Blackboard (working state)** — `.claude-audit/` (gitignored). Canonical;
   the artifact contract (`manifest.yaml`) keys off it. **Never relocated** —
   moving it would break delta mode, the saga markers, and CI gating.
   - `.claude-audit/current/` — per-phase artifacts, `findings.sarif`,
     `findings.cyclonedx.json`, `phase-NN.done` markers.
   - `.claude-audit/baseline.json` — full baseline.
   - `.claude-audit/history/<ts>/` — archived prior runs.
   - `.claude-audit/config.json` — persisted run config (incl. `output_dir`).

2. **Deliverables (user-facing)** — `<output_dir>/` (default
   `docs/security-audit-output/`, tracked — see the ⚠ under "Consumer
   `.gitignore` recipe" for what "tracked" obliges). Written as the **final**
   step of
   Phase 7 (report, sarif, cyclonedx) and Phase 8 (pruned baseline), AFTER the
   blackboard copies already exist. This preserves the blackboard-first
   invariant: the blackboard is written first and is authoritative; the
   deliverables are copies for human/CI consumption.
   - `<output_dir>/security-audit-report.md`
   - `<output_dir>/findings.sarif`
   - `<output_dir>/findings.cyclonedx.json`
   - `<output_dir>/security-audit-baseline.json` (pruned; checked in)

## Resolving `output_dir` (first match wins)

1. **`output:` arg** — e.g. `/security-audit output: reports/sec`.
2. **Persisted config** — `.claude-audit/config.json` → `.output_dir` (set by a
   prior run in this working tree).
3. **Interactive prompt** — shown ONLY when ALL of: stdin is a TTY (`[ -t 0 ]`),
   `$CI` is unset, `$AUDIT_NONINTERACTIVE` is not `1`, and neither
   `--dangerously-skip-permissions` nor
   `$CLAUDE_CODE_DANGEROUSLY_SKIP_PERMISSIONS` is set. Headless runners for any
   harness set `AUDIT_NONINTERACTIVE=1`. One question, default offered:
   > Where should I write the audit deliverables (report, SARIF, SBOM,
   > baseline)? [default: `docs/security-audit-output/`]
4. **Non-interactive fallback** — `docs/security-audit-output/`. Never blocks;
   log the chosen path so the run is reproducible.

After resolution, merge `{"output_dir": "<resolved>"}` into
`.claude-audit/config.json` (do not clobber other keys). All later phases read
`output_dir` from there.

## Delta / report-only baseline discovery

`mode: delta` and `mode: report` resolve the pruned baseline by:

1. `output:` arg dir → `<arg>/security-audit-baseline.json`
2. `.claude-audit/config.json` `.output_dir` → `<dir>/security-audit-baseline.json`
3. default `docs/security-audit-output/security-audit-baseline.json`
4. **legacy fallback** `docs/security-audit-baseline.json` (pre-v2.1 layout)

Because the default dir is tracked, fresh-clone delta works with no args.
`.claude-audit/config.json` is gitignored working state and is **absent on a
fresh clone** — a CI delta run that uses a NON-default output dir MUST pass
`output:` so the baseline is found.

## Consumer `.gitignore` recipe (applied, not suggested — v2.6.1)

Track the human deliverables; ignore the bulky machine artifacts:

```gitignore
# keep tracked: docs/security-audit-output/security-audit-report.md
# keep tracked: docs/security-audit-output/security-audit-baseline.json
docs/security-audit-output/*.sarif
docs/security-audit-output/*.cyclonedx.json
```

Through v2.6.0 this block was advice, and nothing applied it. `workflow.md
§3.5b` now writes it into the consumer's `.gitignore` when `<output_dir>` is
inside a git work tree and not already ignored, and reports the change.

⚠ **This recipe is not the credential control and never was.** It ignores two
file globs; it does nothing for `security-audit-report.md`, which stays tracked
by design and is written from analyst prose. Credentials are kept out of every
deliverable by `steps/phase-04-scanners.md §4.4b` (structural strip at scanner
ingest) and `lib/verify-deliverable.py` (fail-closed gate before each write).
If you are reading this recipe as the reason the deliverables are safe to
commit, read those two instead.

CI that uploads SARIF to the GitHub Security tab reads it from the resolved
`<output_dir>/findings.sarif` (default `docs/security-audit-output/findings.sarif`).
