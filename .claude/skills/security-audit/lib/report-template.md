# Security Audit Report — Template

Used by `steps/phase-07-synthesis.md §7.7` to emit
`phase-07-report.md`. Token-aware: fill only populated sections, omit
empty ones. Keep the executive summary to one page.

---

## 🛑 The one invariant this template exists to enforce (v2.6)

**No printed band may mix `evidence_class` values, and the reading path is
ordered by `evidence_class` — never by `attacked`.**

The v2.5 report told its readers, in the executive summary:

> *"The 182 CONFIRMED + deep-dive findings are the trustworthy spine of this
> report."*

Half of that spine was **9.6%** true and the other half **92.1%** true. Eight
security engineers then triaged 255 HIGH+ findings and measured it:

| Population | n | precision |
|---|---:|---:|
| Judgement (deep-dive, ASVS, config, LINDDUN) | 101 | **92.1%** |
| Mechanical (heuristic reconcilers) | 154 | **11.0%** |

Merging them into one band hid a factor of ten. Worse, the report's own advice
— *"read the confidence bands"* — sent triagers to the **worst** pile first
and the **best** pile last, because `confidence` was only ever set by the
phase that emitted the mechanical rows. `attacked` has the same defect and is
never a band key: a row that was attacked is not thereby more likely to be
true; it merely came from a phase that runs an adversarial pass.

Concretely, the emitter MUST:

1. Order the **Findings** section by `evidence_class` (§ order below), and
   order by severity only *within* a class.
2. Never print a heading, table or list that contains rows of more than one
   `evidence_class`. The one exception is the **Findings Index**, which is a
   locator: it prints no verdict, and carries `evidence_class` as a mandatory
   column on every row.
3. Never use `attacked` to group, sort, promote or headline anything. It is a
   per-finding field and is printed as one.
4. Cap `heuristic_inventory` rows out of the headline bands entirely — they
   are **leads**, and they are labelled as leads.

A report that gets this wrong is not merely imprecise; it actively directs
attention away from the true findings, which is what happened.

---

```markdown
# Security Audit Report

**Project:** {{project_name}}
**Audit ID:** {{audit_id}}
**Skill version:** {{skill_version}}
**Generated:** {{generated_at}}
**Scope:** {{mode}} — {{scope_hint_or_full}}
**Total runtime:** {{duration_minutes}} minutes

## Executive Summary

{{audit_gate_banner}}

<!-- v2.5: when the Phase-7 §7.15 gate reports unresolved governance failures
     (R4 ratchet / L1-L3 lifecycle), this banner MUST be the first thing in the
     summary, verbatim:

       > ## ⛔ AUDIT GATE: FAILED
       > <n> unresolved governance failure(s). No baseline was written for this
       > run — an unexplained downgrade cannot persist itself as the new truth.
       > <bulleted list of the failures with rule ids>

     When the gate is clean, replace this placeholder with the empty string.
     Do NOT soften or omit the banner: a report that reads as a clean bill while
     a CONFIRMED HIGH ages past its threshold is the exact artifact that made a
     92-day exposure look like normal operation. -->

- **Total findings:** {{n_total}}
  — CRITICAL {{n_critical}} · HIGH {{n_high}} · MEDIUM {{n_medium}} · LOW {{n_low}} · INFO {{n_info}}
- **Evidence mix (read this before the severity counts):**
  agent judgement {{n_ev_judgement}} · external scanner {{n_ev_scanner}} ·
  heuristic inventory (leads) {{n_ev_heuristic}} · governance {{n_ev_governance}}
- **Confidence mix:** CONFIRMED {{n_confirmed}} · LIKELY {{n_likely}} · POSSIBLE {{n_possible}}
  <!-- `confidence` is how likely a row is true. It is NOT provenance and NOT
       verification — those are `evidence_class` and `attacked`. Do not build a
       reading order out of this line; that is what the Evidence mix is for. -->
- **Partitions audited:** {{n_partitions_full}} at full depth + {{n_partitions_inventory}} inventory-only
- **Attack surface:** {{n_surfaces}} entry points across {{n_categories}} categories
- **Unique-to-skill findings:** {{n_unique}} (not flagged by any scanner or built-in review)
- **CWE Top 25 (2025) hits:** {{cwe_top25_hits}} (highest-ranked #{{cwe_top25_top_rank}})
- **Exploit-likely (EPSS ≥ 0.10 or CISA-KEV):** {{exploit_likely_count}}
- **Severity escalated by attack-path arithmetic:** {{gate_escalations}} (§7.15 — computed, not asserted)
- **Unscoped collections (rows not bound to the caller):** {{collection_unscoped}} (§6.20)
- **Oldest unremediated HIGH+ (excluding heuristic-inventory rows):** {{gate_oldest_days}} days
- **Sibling sweeps run:** {{sibling_sweeps_run}} / {{n_high_plus}} HIGH+ findings
  · **additional sites found by sweep:** {{sibling_sites_total}}
- **Refutations filed ("What is sound"):** {{n_refutations}} — all scoped

### How to read this report

**Read in this order. It is ordered by how the evidence was obtained, which is
the only property measured to correlate with truth.**

| # | Section | What it is | Last measured precision |
|---|---|---|---|
| 1 | Findings § A — **Agent judgement** | A deep-dive sub-agent read the code | 92.1% (deep-dives alone: 96.6%) |
| 2 | Findings § B — **External scanner** | semgrep / trivy / osv-scanner / gitleaks / trufflehog / hadolint | n/a — external tool, own published rates |
| 3 | Findings § C — **Governance** | claims about this audit's own state, not about your code | n/a |
| 4 | **What Is Sound** | refutations — claims that an alleged defect does *not* hold. **Read the scope column.** | negative claims; see the caveat in that section |
| 5 | Annex — **Heuristic-inventory leads** | this skill's own reconcilers over an inventory a sub-agent wrote | 11.0% |

Sections 1–3 are findings. Section 5 is a **lead list**: it is retained
because it produces complete fix *surfaces* mechanically (one class's nine
distinct legs at exact line granularity, which no analyst enumerated), and
discarded as a *severity* signal because 11% of it is true.

<!-- Precision figures are the standing calibration numbers; the emitter reads
     them from manifest.yaml `rule_family_precision` and prints "not yet
     measured" where a family has no recorded rate. Do not invent a number,
     and do not omit the column — an unlabelled band is what this section
     exists to replace. -->

### Top Risks

<!-- Top Risks are drawn ONLY from Findings § A and § B. A heuristic-inventory
     lead may not be a Top Risk: in the calibrated run, 53 of 73 HIGH+ rows
     from one such family ended CRITICAL while 72 of 73 were false, and they
     displaced real work at the top of the priority list.

     A Top Risk that asserts an ASYMMETRY ("X is clamped and Y is not") and is
     covered by a ratified record in `profile.design_records` MUST carry the
     explicit rebuttal of that record, inline, with the record's path. Without
     one, print the narrow evidenced defect instead and drop the asymmetry
     framing. The calibrated run made "The asymmetry IS the finding" its
     Theme 4 while the project's own ratified record named the compensating
     control and one policy arm was a tautology that could never deny — the
     remediation would have added a call that cannot fire. That sentence is
     precisely the one to distrust when a decision record exists. -->


1. {{top_risk_1}}
2. {{top_risk_2}}
3. {{top_risk_3}}

### Methodology Coverage

| Methodology | Coverage | Findings |
|---|---|---|
| OWASP ASVS 4.0.3 L2 | {{asvs_pct}}% | {{asvs_count}} |
| OWASP Top 10:2025 (web) | {{web_top10_cat_count}}/10 categories fired | {{web_top10_total}} |
| OWASP API Top 10 (2023) | {{api_cat_count}}/10 categories fired | {{api_total}} |
| OWASP LLM Top 10 (2025) | {{llm_status}} | {{llm_count}} |
| OWASP Agentic Apps (2026) | {{agentic_status}} | {{agentic_count}} |
| LINDDUN (privacy) | {{linddun_status}} | {{linddun_count}} |
| STRIDE | {{stride_partition_count}} partitions covered | see Appendix C |
| Authorized-Egress (cross-layer) | {{egress_status}} | {{egress_count}} |
| CWE tags | {{unique_cwe_count}} unique CWE IDs | — |
| MITRE CWE Top 25 (2025) | {{cwe_top25_hits}}/25 hit (top #{{cwe_top25_top_rank}}) | {{cwe_top25_count}} |

---

## Partition Risk Ranking

| # | Partition | Kind | LOC | Risk | Depth | Findings |
|---|-----------|------|-----|------|-------|----------|
{{per_partition_rows}}

---

## Findings

<!-- STRUCTURE IS LOAD-BEARING. Sections are keyed on `evidence_class`;
     severity is the sub-key. A heading below NEVER contains rows of more than
     one evidence class. Omit any class with zero rows — do not print an empty
     band, and do not merge a thin band into its neighbour to avoid one.

     ROUTING — total, exclusive, and in this order. Every row lands in exactly
     one place, and a row that matches nothing is a bug, not a row to drop:

       attacked == "refuted"                 -> "What Is Sound", NOT a band,
                                                NOT in the Findings Index
       evidence_class == heuristic_inventory -> Annex (leads)
       evidence_class == governance          -> § C
       evidence_class == external_scanner    -> § B
       evidence_class == agent_judgement     -> § A

     Assert before emitting: |§A| + |§B| + |§C| + |Annex| + |What Is Sound|
     == total rows. Print the count in the Audit Coverage table. -->


### Findings Index (locator — not a band)

Every finding, ordered by severity for the reader who wants the CRITICAL
roll-up. This table carries **no verdict and no prose**; the `Evidence` column
is mandatory on every row and the `§` column points at the band the finding is
actually argued in.

| Severity | Evidence | § | ID | Title | Location |
|---|---|---|---|---|---|
{{findings_index_rows}}

---

### § A — Agent judgement

Deep-dive sub-agents read the code. This is the highest-precision population
in the audit and it is deliberately first.

#### CRITICAL
{{judgement_critical_block}}
#### HIGH
{{judgement_high_block}}
#### MEDIUM
{{judgement_medium_block}}
#### LOW
{{judgement_low_block}}
#### INFO
{{judgement_info_block}}

### § B — External scanner

Rows whose `sources[].detail` names an independent tool — semgrep, trivy,
osv-scanner, gitleaks, trufflehog, hadolint. This is the **only** class that
earns the §7.4 `+1` promotion.

#### CRITICAL
{{scanner_critical_block}}
#### HIGH
{{scanner_high_block}}
#### MEDIUM
{{scanner_medium_block}}
#### LOW
{{scanner_low_block}}
#### INFO
{{scanner_info_block}}

### § C — Governance

Meta-findings about **this audit's own state** — the R4 severity ratchet, the
L1–L3 lifecycle gates. They are not claims about your code and they are not
mixed with claims that are.

{{governance_block}}

(Per-finding block format, all bands:)

> #### {{id}}: {{title}}
> - **Severity:** {{severity}} (asserted {{severity_asserted}} → computed {{severity_computed}}{{escalation_rules_note}})
> - **Evidence class:** {{evidence_class}} · **Confidence:** {{confidence}} · **Attacked:** {{attacked}}
> - **Category:** {{category}} · **Partition:** {{partition}}
> - **Location:** {{file}}:{{line}}
> - **CWE:** [{{cwe}}](https://cwe.mitre.org/data/definitions/{{cwe_number}}.html){{cwe_top25_badge}}
> - **OWASP:** {{owasp_ids_joined}}
> - **Exploit signal:** {{epss_kev_badge}} (omit line if neither EPSS nor KEV present)
> - **Sources:** {{sources_joined}}
> - **Description:** {{description}}
> - **Attack scenario:** {{attack_scenario}}
> - **Reachability:** {{deployment_reachability}} (omit when `reachable`; a non-`reachable` state without a cite is printed WITH the words "no cite")
> - **Other sites of this defect ({{sibling_count}}):** {{sibling_sites_list}}
>   - **Pattern run:** `{{sibling_pattern}}`
>   - (When `sibling_sites` is empty the line reads: *"Swept — this is the only site in the repository."* An empty list with **no** pattern is printed as *"NOT SWEPT"*, never as "only site".)
> - **Verification probe:** {{verification_probe}} (the request that should fail — run it to confirm; omit line if absent)
> - **Suggested fix:** {{suggested_fix}} — **fix confidence: {{fix_confidence}}**
>   - (`verified` prints the cited `dependency:line` that proves it. A fix with
>      no `fix_confidence` is printed as `untested`, never silently as fact.)
> - **Effort:** {{remediation_effort}}

<!-- ⛔ NO CREDENTIAL VALUES IN ANY FIELD OF THIS BLOCK. This template renders
     into `<output_dir>/security-audit-report.md`, which is a TRACKED file in
     the audited repository — `lib/output-routing.md` keeps it tracked so that
     `mode: delta` works on a fresh clone.

     `{{description}}`, `{{attack_scenario}}`, `{{suggested_fix}}` and
     `{{verification_probe}}` are free text written by an analyst, and they are
     the ONE path into a deliverable that the Phase 4 structural strip cannot
     cover. Cite `{{file}}:{{line}}` and the finding's
     `properties.secret_fingerprint`; never the value, never a prefix, never a
     hand-masked excerpt. Full rule: `steps/deepdive/cat-06-secret-sprawl.md`
     §"Reporting rule: never write the value".

     `lib/verify-deliverable.py` gates this file before it is copied. A value
     that reaches it is scrubbed and raises a CRITICAL finding against the
     SKILL (`phase-07-synthesis.md §7.10a`), not against the audited code. -->

<!-- WHY the per-finding block separates the finding from the fix: the
     calibrated run produced six findings on ONE Postgres-TLS defect. The
     finding was right on all six; the fix was wrong on five. Five prescribed
     a nine-site code change plus CA bundling; one prescribed a one-word
     `?sslmode=verify-full` substitution and cited the driver source proving
     it. The correct fix was in the minority, and the report merged the wrong
     text into its priority list. Fix text is what gets executed. -->

---

## What Is Sound (refutations)

Alleged defects that were examined and did **not** hold. **Read the scope
column before you rely on a row.**

Rows are `category: "methodology"`, `attacked: "refuted"` findings, grouped by
the host category named in their `notes`.

| # | Host category | Claim refuted | Boundary examined (`refutation_scope`) | Confidence | Evidence |
|---|---|---|---|---|---|
{{refutation_rows}}

<!-- EMITTER RULES — these are hard, and this table is where the most
     expensive error in the calibrated run was printed.

     1. NO ROW WITHOUT `refutation_scope`. A refutation with no stated
        boundary is not printed at all — it is listed under "Not established"
        below with its id, so the omission is visible rather than silent.
     2. NO SYSTEM-LEVEL ASSERTION FROM A SINGLE-MODULE EXAMINATION. If
        `refutation_scope` names one module, one file, or one call-graph hop,
        the "Claim refuted" cell must be rewritten to name that boundary
        explicitly ("within `pkg/foo`, X does not …"). An unqualified claim is
        rejected, not softened.
     3. REFUTATIONS PRINT ONE CONFIDENCE RUNG BELOW the same evidence as a
        finding, and never CONFIRMED off a single-module read. A positive
        claim about one line is established by reading that line; a negative
        claim over a surface is only established by enumerating the surface.
     4. A refutation of the form "credential X does not reach sink Y",
        established by reading X's PRODUCER, requires a caller enumeration of
        the accessor in `refutation_scope` — command and count. Without it the
        row does not print.

     THE INCIDENT: a refutation true of ONE module — "the key never leaves the
     module" — was generalised to a system property and printed here. Two call
     sites hand a GitHub App signing key to a function that sets
     `Authorization: Bearer ${pat}`. A real HIGH was filed under the one
     heading readers are told to trust. A false positive costs a triager
     minutes and is self-correcting; a wrong refutation stops them reading the
     code, and nothing downstream reopens it. -->

**Not established** (examined, but the boundary was not recorded — treat these
as open, not sound): {{unscoped_refutation_ids}}

> **Scope & honesty.** Every row above is a *negative* claim. A negative claim
> is bounded by what was read and by nothing else. "Sound" here means "no
> defect was found within the stated boundary" — it never means "no defect
> exists".

---

## Annex — Heuristic-inventory leads (NOT findings)

Rows produced by this skill's own reconcilers (`validate-egress.py`,
`validate-collection-scoping.py`) over an inventory a sub-agent wrote. They
are **capped out of the headline severity bands by construction** and carry no
severity of their own.

- **Leads:** {{annex_lead_count}} · **attached to a judgement finding:** {{annex_attached_count}} · **orphan (no judgement twin):** {{annex_orphan_count}}
- **Last measured precision of this population:** {{annex_precision}}

{{annex_orphan_list}}

> **Why this is kept and why it is not a finding list.** Of the true
> mechanical rows in the calibrated run, 15 of 17 were restatements of a
> deep-dive finding on the same line, and the family surfaced no unique
> CRITICAL — so as a *severity* signal it is noise. But it enumerated one
> credential-exfil class's **nine distinct legs at exact line granularity**,
> which no analyst did. Precision is the wrong metric for a rule whose product
> is a surface rather than a conclusion. Read this annex when you are fixing
> something in § A; do not read it as a queue.

---

## Attack Surface Summary

| Category | Count | Notable surfaces |
|---|---|---|
{{surface_category_rows}}

---

## Authorized-Egress (cross-layer access control)

Result of the Phase 6 §6.19 reconciliation — does every path that emits a
sensitive resource's bytes enforce that resource's strongest intended gate?

- **Sensitive resources:** {{egress_sensitive_count}} (default-deny;
  {{egress_public_count}} on the public allowlist — review: {{egress_public_list}})
- **Egress sinks inventoried:** {{egress_sink_count}} · **candidates dismissed:** {{egress_dismissed_count}}
- **Coverage gate:** {{egress_coverage_status}} (fail-closed — a silently-omitted sink fails the run)
- **Cross-layer / missing-enforcer findings:** {{egress_finding_count}}

{{egress_findings_block}}

> **Scope & honesty.** A clean reconciliation means every *known* egress
> candidate (per `lib/egress-detection.md`) was accounted for and gated — it is
> high-signal but **NOT a proof of absence**. CDN-edge egress with no code path,
> and any modality outside the catalogue, are out of mechanical reach and listed
> here as caveats, never silently dropped: {{egress_caveats}}

---

## Collection Scoping (row-level access control)

Result of the Phase 6 §6.20 reconciliation — for every endpoint that returns a
list, are the rows constrained to the caller? A gate being *present* does not
answer this question; that is the whole point of the section.

- **Collections inventoried:** {{collection_count}} · **candidates dismissed:** {{collection_dismissed_count}}
- **By row scope:** caller_bound {{collection_caller_bound}} · visibility_filtered {{collection_visibility_filtered}} · public_allowlisted {{collection_public}} · role_restricted {{collection_role_restricted}} · **unscoped {{collection_unscoped}}** · unknown {{collection_unknown}}
- **Coverage gate:** {{collection_coverage_status}} (fail-closed — a silently-omitted list query fails the run)
- **Findings:** C1 unscoped {{collection_c1}} · C2 decoration {{collection_c2}} · C3 coverage {{collection_c3}} · C4 test-pinned {{collection_c4}} · C5 unevidenced claim {{collection_c5}} · C6 miscited predicate {{collection_c6}}
- **Public-resource allowlist (review this):** {{collection_public_list}}

{{collection_findings_block}}

> **Scope & honesty.** A clean reconciliation means every *known* list-query
> candidate was accounted for and scoped — high-signal, **not** a proof of
> absence. A scope applied by an un-modelled mechanism (a base scope, a
> tenant-injecting repository, database row-level security) is missed in the
> conservative direction — the §6.20 adversarial pass exists to retire those.
> Runtime-assembled queries are recorded as caveats, never as silent passes:
> {{collection_caveats}}

---

## Severity Gate (computed severity + finding lifecycle)

Result of the Phase 7 §7.15 gate. Severity here is **computed over composed
attack paths**, not asserted per finding — `severity_asserted` is retained only
as the analyst's opinion.

- **Findings carrying capability tags:** {{gate_tagged}} / {{gate_total}}
- **Escalations applied:** {{gate_escalations}} — {{gate_escalation_list}}
- **Personas evaluated:** {{gate_personas}}
- **Crown jewels reached from an unprivileged persona:** {{gate_jewels}}
- **Governance failures (R4 ratchet, L1–L3 lifecycle):** {{gate_blocking}}
- **Oldest unremediated CONFIRMED HIGH+:** {{gate_oldest_days}} days ({{gate_oldest_id}})

{{gate_governance_block}}

**Orphan capabilities** (vocabulary drift — a chain that should have composed and
did not): {{gate_orphans}}

> **Scope & honesty.** The composer can only compose what was tagged. R2 (prose
> naming another finding) backstops untagged chains; the orphan list backstops
> R2. None of this makes chain analysis complete — it makes the gaps loud, and it
> stops a tagged chain from being out-voted by instinct.

---

## Route Inventory (first 50)

| # | Method | Path | Auth | Roles | Partition | Handler |
|---|--------|------|------|-------|-----------|---------|
{{first_50_routes}}

(Full inventory in `.claude-audit/current/phase-02-surface.json`.)

---

## Audit Coverage

| Phase | Status | Notes |
|---|---|---|
| Phase 0 Discovery | completed | {{phase0_notes}} |
| Phase 1 Partition | completed | {{phase1_notes}} |
| Phase 2 Surface Inventory | completed | {{phase2_notes}} |
| Phase 3 Keystone Index | completed | {{phase3_notes}} |
| Phase 4 Scanners | {{phase4_status}} | {{phase4_notes}} |
| Phase 5 Deep Dives | {{phase5_status}} | {{phase5_notes}} |
| Phase 6 Config + Methodology | {{phase6_status}} | {{phase6_notes}} |

---

## Unique-to-Skill Findings

The following findings were identified only through the systematic
inventory-based audit and were NOT flagged by `/security-review`, the
adversarial review, or the scanner bundle. These represent the skill's
specific value-add.

{{unique_findings_list}}

---

## Remediation Roadmap

Grouped by estimated effort (from each finding's `remediation_effort`).

<!-- ⛔ SUBSYSTEM-WIDE REMEDIATIONS ARE NOT EMITTABLE WITHOUT AN ENUMERATED
     MEMBER LIST.

     A roadmap item of the form "add X across `path/**`" — or across a
     directory, a route group, a middleware chain, or "all handlers that …" —
     is a CLAIM ABOUT EVERY MEMBER OF THAT SET and carries the same evidence
     bar as a finding. The emitter MUST refuse to print the glob form. It
     prints instead:

       ### Add `requireRegionScope` to 5 of 16 reconciliation handlers
       | Member | What the fix clamps | Evidence |
       |---|---|---|
       | admin/reconciliation/adjust.post.ts:31 | `ledger.region_id` | schema:88 |
       | …                                      | …                  | …        |
       **Excluded (nothing to clamp):** <member> — <why>, cited.

     Every member is named. For every member, the specific thing the fix
     clamps is named and cited. A member whose clamp cannot be named is
     EXCLUDED EXPLICITLY with the reason — not silently dropped, and not
     silently included.

     THE INCIDENT: the report advised "add `requireRegionScope` across
     `admin/reconciliation/**`". 11 of the 16 handlers had NOTHING to clamp —
     the pivotal table has no region column — so the change would either no-op
     or deny every region admin. And the exemption list had one backwards: an
     unclamped cross-region hard DELETE on a table that DOES carry the column.
     A glob is not a plan; it is an untested claim about n files. -->

### Exploit-likely (fix first — EPSS ≥ 0.10 or CISA-KEV)

{{exploit_likely_list}}

### Trivial (≤1 hour)

{{trivial_list}}

### Small (≤1 day)

{{small_list}}

### Medium (≤1 week)

{{medium_list}}

### Large (≥1 week)

{{large_list}}

---

## Appendix A — ASVS Checklist

{{asvs_full_table}}

## Appendix B — STRIDE Tables

{{stride_tables_inline}}

## Appendix C — Scanner Provenance

| Scanner | Version | Status | Findings | Notes |
|---|---|---|---|---|
{{scanner_rows}}

## Appendix D — Dependencies (SBOM summary)

- `findings.cyclonedx.json` at `.claude-audit/current/` — CycloneDX 1.5
  SBOM, VEX-ready.
- Top 10 direct dependencies with known CVEs:

{{top_vulnerable_deps}}

---

*Generated by `/security-audit` v{{skill_version}}. Full machine-readable
artifacts are in `.claude-audit/current/`. Re-run `/security-audit mode:
delta` after fixes to verify remediation.*
```
