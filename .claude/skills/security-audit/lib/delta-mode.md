# Delta Mode — Invalidation Algorithm

Reference for `workflow.md §4 "mode: delta"` and
`steps/phase-08-baseline.md §8.6`. The algorithm is implemented by the
orchestrator before Phase 0 runs; this file is the authoritative
description.

## Preconditions

1. The pruned baseline exists, resolved per [output-routing.md](output-routing.md):
   `output:` arg → `.claude-audit/config.json` `.output_dir` → default
   `docs/security-audit-output/security-audit-baseline.json` → legacy fallback
   `docs/security-audit-baseline.json` (pre-v2.1 layout).
2. `.claude-audit/baseline.json` also exists (the full baseline);
   delta mode uses the full one for findings carryover.
3. The baseline's `git_head` is reachable from the current HEAD
   (`git merge-base --is-ancestor <baseline.git_head> HEAD`).
4. The baseline is ≤90 days old (override with
   `--force-stale-baseline`).

If any precondition fails, fall back to full mode with a clear
explanation; do NOT silently re-run.

## Algorithm

### Step 1 — Collect inputs

```
baseline_full   = read(.claude-audit/baseline.json)
baseline_pruned = read(<resolved pruned-baseline path>)   # see Preconditions §1
changed_files   = git diff --name-only <baseline_full.git_head> HEAD
                    | exclude patterns from baseline_full.ignored
```

### Step 2 — Build invalidation set

Start with two empty sets:
```
stale_surfaces  = set()   # surface.id whose handler changed
stale_partitions = set()  # partition.id that needs full re-run (not just touched surface)
```

#### 2a — File-level surface staleness

```
for surface in baseline_full.surface:
  # Check BOTH the registration site and the handler body file — a
  # change to either can invalidate the surface. Without this, modular-
  # routing frameworks (Express with `app.use('/x', require('./x'))`)
  # silently escape the file-level rule.
  if (surface.handler_file in changed_files
      or surface.registration_file in changed_files):
    stale_surfaces.add(surface.id)
  elif surface.handler_hash != current_hash(surface.handler_file, surface.line_range):
    stale_surfaces.add(surface.id)
```

The `current_hash` re-parse uses the same procedure as Phase 2 /
`lib/handler-hash.md` — normalize, hash, compare, **against the handler
body file**. If the body can't be re-located (file deleted / heavily
renamed), treat as stale.

#### 2b — Partition-level staleness (manifest / LOC threshold)

```
for partition in baseline_full.partition_manifest:
  changed_in_partition = {f for f in changed_files if f matches partition.paths_included}
  if len(changed_in_partition) / partition.file_count > 0.20:
    stale_partitions.add(partition.id)

  # Manifest-file check
  manifests = [partition.path + "/package.json",
               partition.path + "/go.mod",
               partition.path + "/Cargo.toml",
               partition.path + "/pyproject.toml",
               partition.path + "/pom.xml",
               partition.path + "/Gemfile.lock",
               partition.path + "/composer.lock",
               ...]
  if any(m in changed_files for m in manifests):
    stale_partitions.add(partition.id)
```

#### 2c — Keystone invalidation

```
changed_keystones = {kf for kf in baseline_full.keystone_files
                     if kf.path in changed_files}
if changed_keystones:
  # Any auth_matrix row in the baseline becomes stale
  stale_auth_matrix = True
  # Every partition that imports a changed keystone becomes stale
  for kf in changed_keystones:
    stale_partitions |= set(kf.partitions)
else:
  stale_auth_matrix = False
```

#### 2d — Config invalidation

```
config_paths = [f for f in changed_files if
                f matches "config/*" or
                f matches "*.config.*" or
                f in framework_config_list]
if config_paths:
  rerun_phase_06 = True
else:
  rerun_phase_06 = False
```

#### 2e — Dependency invalidation

```
lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock",
             "go.sum", "Cargo.lock", "composer.lock", "Gemfile.lock",
             "poetry.lock", "Pipfile.lock", "uv.lock"]
if any(f in changed_files for f in lockfiles):
  rerun_phase_04 = True    # scanners, esp. osv-scanner
else:
  rerun_phase_04 = False
```

#### 2f — Authorized-Egress: ALWAYS global, never carried from baseline (v2.4)

The cross-layer / missing-enforcer class is **invisible to a partition-scoped
delta**: the credential's writer and the resource's byte-serving sink routinely
live in different partitions, so a change to *either* (or to neither — a pure
copy-forward of a flawed pattern) can open the gap, and "a pre-existing gap is
not a delta" is exactly why the original bug survived. Therefore:

```
# The egress inventory + reconciliation do NOT respect touched_partitions.
rerun_egress_global = True   # unconditional, every delta run
```

- Phase 2 §2.11 re-enumerates `phase-02-sinks.json` + `phase-02-credentials.json`
  **across the whole repo**, even though the surface inventory is partition-scoped.
- Phase 6 §6.19 (`validate-egress.py`, incl. the fail-closed coverage gate)
  **always runs in full**, over the freshly-regenerated global inventory.
- Egress findings (`category in {auth, idor}` sourced from `validate-egress.py`)
  are **never** carried forward via §4; they are recomputed every run. This is
  the bounded cost of correctness for this class (enumeration, not deep-dive —
  seconds, not minutes).
- **Resource-rename invalidation.** If a `data_model` entity `id` changed since
  baseline (rename refactor), invalidate ALL egress findings — a renamed
  `serves_resource` would silently stop joining to `protects_resources` and the
  class would look "fixed". Detect via a diff of `profile.data_model.entities[].id`.

#### 2g — Collection scoping + the severity gate: ALWAYS global (v2.5)

Same reasoning as 2f, for the same reason it applied there. An unscoped
collection is a **pre-existing** condition, not a delta: the handler that
disclosed every user's private decks had been wrong since it was written, and
"nothing in this partition changed" would have carried it forward untouched
forever.

```
rerun_collections_global = True   # unconditional, every delta run
rerun_severity_gate      = True   # unconditional, every delta run
```

- Phase 2 §2.12 re-enumerates `phase-02-collections.json` **across the whole
  repo**, even when the surface inventory is partition-scoped.
- Phase 6 §6.20 (`validate-collection-scoping.py`, incl. the fail-closed coverage
  gate) **always runs in full**.
- `category == collection_scope` findings are **never** carried forward via
  §4; they are recomputed every run.
- **Entity-rename invalidation** applies identically: a renamed `data_model`
  entity id would stop joining to `public_resources` and to `owner_cols`,
  making an unscoped collection look allowlisted. Invalidate all collection
  findings when any entity id changes.

The **Phase-7 §7.15 severity gate always runs**, over the union of new and
carried-forward findings — never over the new ones alone. Three of its rules are
meaningless otherwise:

- **R1** must see a carried-forward enumeration finding to discover that a *new*
  finding's "only if the id is known" precondition is already supplied.
- **R4** compares against the baseline by definition.
- **L1** ages carried-forward findings; a delta run that skipped it would let a
  finding age past its threshold precisely because nothing near it changed —
  which is the shape of the 96-day failure, not a defence against it.

Carried-forward findings keep their `first_seen_at`, `severity_history[]` and
`lifecycle` verbatim (§4). Losing those in carryover silently disables the
ratchet and the age gate.

### Step 3 — Scope computation

```
touched_partitions
  = stale_partitions
  ∪ { surface_to_partition(sid) for sid in stale_surfaces }
  ∪ { partition(f) for f in changed_keystones.paths }
  ∪ { partition(f) for f in changed_manifest_files }

# Add adjacency: partitions that share a keystone with a touched one
for kf in baseline_full.keystone_files:
  if any(p in touched_partitions for p in kf.partitions):
    touched_partitions |= set(kf.partitions)
```

### Step 4 — Carry forward non-touched findings

```
carryover = []
for finding in baseline_full.findings_carryover:
  if finding.partition not in touched_partitions
     and finding.file not in changed_files
     and (not stale_auth_matrix or finding.category != "auth"):
    # Not invalidated → carry forward
    finding.sources.append({kind: "baseline", detail: baseline_audit_id})
    carryover.append(finding)
```

### Step 5 — Execute partial audit

Run Phases 2-7 scoped to `touched_partitions`:
- Phase 2 re-enumerates surfaces only for touched partitions — **EXCEPT** the
  egress inventory (`phase-02-sinks.json` / `phase-02-credentials.json`), which
  is regenerated **globally** every delta run (§2f).
- Phase 6 §6.19 Authorized-Egress reconciliation **always runs in full** (§2f),
  regardless of `rerun_phase_06`.
- Phase 3 re-indexes keystones only for touched partitions (but
  existing cache entries for non-touched are kept).
- Phase 4 either re-runs full (if `rerun_phase_04`) or reuses the
  previous scanner output.
- Phase 5 fans out only for touched partitions × categories.
- Phase 6 either re-runs full (if `rerun_phase_06`) or reuses the
  previous config output.
- Phase 7 synthesis merges:
  - `carryover` findings (from baseline)
  - Fresh Phase 5 + Phase 6 findings (from this run)
  - Scanner findings (either full or carry-forward per §2e)

### Step 6 — Emit delta report

`phase-07-report.md` gets a **Delta Summary** section as a preamble:

```markdown
# Delta Audit Report

**Baseline:** <baseline.created_at> (<baseline.git_head[0:8]>)
**Current HEAD:** <git_head[0:8]>
**Files changed:** <len(changed_files)>
**Partitions re-audited:** <len(touched_partitions)>
**Carried forward:** <len(carryover)> findings from baseline
**New findings this run:** <new_count>
**Fixed since baseline:** <fixed_count>  (findings in baseline that no
                                          longer reproduce)

---
<rest of report template as usual>
```

### Step 7 — Baseline refresh (optional)

By default, delta mode does NOT overwrite the baseline (that's Phase 8
of a full run). If the user passes `--refresh-baseline`, Phase 8
runs at the end of the delta run, producing a new baseline that
reflects the current state.

## Expected runtime

On a 100K-LOC repo with a typical PR (5-20 changed files, 0-2
touched partitions):
- Preflight + invalidation: <5 sec
- Phases 2-3 scoped: 10-30 sec
- Phase 4 carry-forward (no changed lockfiles): 2-3 sec
- Phase 5 fan-out for touched partitions: 1-3 min (vs. 15-30 min full)
- Phase 6/7: 30-60 sec

**Typical total: 2-5 min.** Full audits take 15-60 min. Delta's
speed-up is ~10× on average.

## Invariants

1. A delta-mode run never produces findings a full run wouldn't.
2. A delta-mode run never deletes findings a full run would still
   produce (i.e., non-touched findings carry forward until proven
   absent — *not* until proven present).
3. Baseline promotion of findings ("was LIKELY, now CONFIRMED because
   a new scanner result corroborated it") happens in Phase 7
   synthesis as usual — baseline findings are merged into the
   findings list and then pass through dedup + confidence logic.
4. **The Authorized-Egress reconciliation (§2f) is exempt from carryover** —
   its inventory and findings are recomputed globally on every run (full or
   delta). A delta run must never report this class as "carried forward /
   accepted"; a pre-existing cross-layer gap is not a delta and must re-raise.
