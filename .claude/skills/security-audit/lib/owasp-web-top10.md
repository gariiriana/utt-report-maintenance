# OWASP Top 10:2025 (web) + MITRE CWE Top 25 (2025) — Mapping Reference

Companion to `steps/phase-06-config.md §6.16` (web-Top-10 roll-up) and
`steps/phase-07-synthesis.md §7.13` (CWE-Top-25 enrichment).

**Editions encoded (verified against `docs/research/05-methodology-standards.md`):**

- **OWASP Top 10:2025 (web)** — FINAL. Announced Nov 2025 at OWASP Global
  AppSec DC; final text released Jan 2026. Canonical category list:
  `https://owasp.org/Top10/2025/`. Tag form: `A##:2025` (e.g. `A03:2025`).
- **MITRE CWE Top 25 (2025)** — published **2025-12-15** (analysis window
  2024-06-01 → 2025-06-01, 39,080 CVEs; MITRE with CISA + HSSEDI).
  Canonical: `https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html`.

Both layers are **derived from the per-finding CWE tag the skill already
emits** — pure lookups, no sub-agent fan-out, no new analysis.

---

## Part 1 — OWASP Top 10:2025 (web) categories

What materially changed from the 2021 edition (per the research report):

- **A03 Software Supply Chain Failures is NEW** — expands 2021's
  "Vulnerable & Outdated Components" to dependencies, build systems, and
  distribution infrastructure.
- **A10 Mishandling of Exceptional Conditions is NEW** — improper error
  handling, logical errors, failing open.
- **SSRF is folded into A01 Broken Access Control** (no longer its own
  category as it was in 2021).
- **Security Misconfiguration is up to A02** (from #5 in 2021).
- **A05 Injection dropped** from #3 (2021) to #5 (2025).
- **A07 renamed** "Authentication Failures" (was "Identification and
  Authentication Failures").
- **A09 renamed** "Security Logging and Alerting Failures" ("Monitoring"
  → "Alerting").

### CWE → A##:2025 lookup table

The roll-up assigns each finding to the **first** category whose hint set
contains the finding's `properties.cwe`. Categories are ordered A01→A10 so
the more specific access-control / supply-chain buckets win ties. Every
`CWE-NNN` below is present in `lib/cwe-map.json`.

| Category (2025) | CWE hints (members of `lib/cwe-map.json`) |
|---|---|
| **A01:2025 Broken Access Control** (absorbs SSRF) | CWE-284, CWE-285, CWE-862, CWE-863, CWE-639, CWE-352, CWE-918, CWE-601, CWE-200 |
| **A02:2025 Security Misconfiguration** | CWE-1035, CWE-276, CWE-732, CWE-614, CWE-1004, CWE-1275, CWE-538, CWE-552 |
| **A03:2025 Software Supply Chain Failures** (NEW) | CWE-1395, CWE-1357, CWE-1104, CWE-494, CWE-506, CWE-829 |
| **A04:2025 Cryptographic Failures** | CWE-311, CWE-319, CWE-321, CWE-326, CWE-327, CWE-328, CWE-329, CWE-330, CWE-331, CWE-338, CWE-916, CWE-522 |
| **A05:2025 Injection** | CWE-79, CWE-89, CWE-77, CWE-78, CWE-90, CWE-91, CWE-94, CWE-943, CWE-1321, CWE-611, CWE-117, CWE-20 |
| **A06:2025 Insecure Design** | CWE-636, CWE-1059 |
| **A07:2025 Authentication Failures** | CWE-287, CWE-288, CWE-306, CWE-307, CWE-384, CWE-521, CWE-613, CWE-640, CWE-798, CWE-345, CWE-347 |
| **A08:2025 Software or Data Integrity Failures** | CWE-502, CWE-915, CWE-470 |
| **A09:2025 Security Logging and Alerting Failures** | CWE-532, CWE-778, CWE-201 |
| **A10:2025 Mishandling of Exceptional Conditions** (NEW) | CWE-209, CWE-215 |

**Notes for the roll-up:**

- **SSRF (CWE-918) maps to A01**, not to Injection — this is the 2025 fold.
  Keep the finding's own `category: injection` tag; only the `A##:2025`
  roll-up changes.
- **A03 Supply Chain** draws primarily from cat-10 (supply chain) findings
  and scanner SBOM/dependency results (osv-scanner, trivy, grype). A
  finding can legitimately roll up to A03 even though its `category` is
  `supply_chain`.
- A CWE that is genuinely ambiguous across two buckets (e.g. CWE-345
  integrity vs. auth) is assigned to the **first** matching row above; do
  not double-count a single finding into two A## categories.
- The web Top 10 and the **API Top 10 (2023)** spine (§6.10) are kept
  **both** — they overlap but serve different audiences. Do not collapse.

---

## Part 2 — MITRE CWE Top 25 (2025) ranked list

Published 2025-12-15. Used as a **prioritization signal only** — see
`steps/phase-07-synthesis.md §7.13`. Membership stamps
`properties.cwe_top25_2025_rank` (1–25) onto a finding; it may raise
reporting priority by **at most one rung** and **never lowers** severity
(the existing ±1-rung cap in §7.4 is authoritative).

Entries that are present in `lib/cwe-map.json` are written in the canonical
`CWE-NNN` form. Entries that are **outside the audit's CWE map** (the
memory-safety weaknesses, which this polyglot web-app audit does not map)
are listed by **number + name only** (no `CWE-` prefix) so they remain
informative without violating the cwe-map cross-reference invariant; a
finding can only be stamped with a rank if its CWE is also in the map, so
these never actually fire here.

| Rank | Weakness | In cwe-map? |
|---|---|---|
| 1 | CWE-79 — Cross-site Scripting | yes |
| 2 | CWE-89 — SQL Injection | yes |
| 3 | CWE-352 — Cross-Site Request Forgery | yes |
| 4 | CWE-862 — Missing Authorization | yes |
| 5 | #787 — Out-of-bounds Write | no (memory-safety) |
| 6 | CWE-22 — Path Traversal | yes |
| 7 | #416 — Use After Free | no (memory-safety) |
| 8 | #125 — Out-of-bounds Read | no (memory-safety) |
| 9 | CWE-78 — OS Command Injection | yes |
| 10 | CWE-94 — Code Injection | yes |
| 11 | #120 — Classic Buffer Overflow | no (memory-safety) |
| 12 | CWE-434 — Unrestricted Upload of File with Dangerous Type | yes |
| 13 | #476 — NULL Pointer Dereference | no (memory-safety) |
| 14 | #121 — Stack-based Buffer Overflow | no (memory-safety) |
| 15 | CWE-502 — Deserialization of Untrusted Data | yes |
| 16 | #122 — Heap-based Buffer Overflow | no (memory-safety) |
| 17 | CWE-863 — Incorrect Authorization | yes |
| 18 | CWE-20 — Improper Input Validation | yes |
| 19 | CWE-284 — Improper Access Control | yes |
| 20 | CWE-200 — Exposure of Sensitive Information | yes |
| 21 | CWE-306 — Missing Authentication for Critical Function | yes |
| 22 | CWE-918 — Server-Side Request Forgery (SSRF) | yes |
| 23 | CWE-77 — Command Injection | yes |
| 24 | CWE-639 — Authorization Bypass Through User-Controlled Key | yes |
| 25 | CWE-770 — Allocation of Resources Without Limits | yes |

New-to-2025 entries flagged by the research report include CWE-284
(Improper Access Control), CWE-639 (auth bypass via user-controlled key),
and CWE-770 (resource allocation without limits) — all in the map and so
all eligible to stamp a rank.

**Implementation contract (consumed by §7.13):** the in-map ranked pairs
above are the lookup set. For each finding whose `properties.cwe` matches a
`CWE-NNN` row, stamp `properties.cwe_top25_2025_rank` = that row's rank.
The seven memory-safety rows never match (their CWEs are not in the map),
which is correct for a web/polyglot application audit.
