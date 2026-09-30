# Known-Vuln Versions — SCA Version-Threshold Reference

Curated, version-pinned reference of high-profile recent framework/library
CVEs with **fixed-version thresholds**. This is the "SCA version-threshold"
detector consumed by `cat-10-supply-chain.md` and `cat-11-mcp-agentic.md`: a
sub-agent greps the partition's manifests / lockfiles
(`package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`,
`requirements*.txt`, `poetry.lock`, `Pipfile.lock`, `Cargo.toml`/`Cargo.lock`)
for the package, parses the resolved version, and flags it when it is
**below the fixed threshold**.

---

## ⚠️ Caveat — READ BEFORE RELYING

- **This table is a STARTING POINT, not ground truth.** It captures the
  research window (≈2025-12 → 2026-06) and ages out fast.
- **Every CVE ID and fixed-version threshold MUST be re-verified against
  NVD / the upstream advisory before it is shipped in a finding.** Do not
  encode a CVE ID as fact in a report on the strength of this file alone.
  Cite the primary advisory in the finding's `sources`.
- The canonical, always-current SCA signal is `osv-scanner` (Phase 4),
  which queries the live OSV database. This file exists to catch the
  *recent, high-profile* CVEs that a stale local OSV mirror may miss and
  to give the sub-agent a curated short-list with exploitation context.
  **Prefer `osv-scanner` output; use this table as corroboration / backstop.**
- A version at or above the threshold is NOT proof of safety (transitive
  pulls, range-resolved installs, monorepo hoisting). When in doubt,
  emit `confidence: POSSIBLE` and recommend an `npm ls` / `pip show` check.

---

## Version-threshold table

| Package (ecosystem) | Vulnerable range | Fixed at | CVE (verify on NVD) | Class | CWE | Sev anchor |
|---|---|---|---|---|---|---|
| `langchain-core` (PyPI) | `< 0.3.81` and `< 1.2.5` | `0.3.81` / `1.2.5` | CVE-2025-68664 | `dumps()`/`dumpd()` `lc`-key serialization injection → secret exfil, **prompt-injection-triggerable** | CWE-502 | CRITICAL |
| `@langchain/core` (npm) | JS vuln range — verify | per advisory | CVE-2025-68665 | JS analogue of 68664 (`lc`-key dict not escaped) | CWE-502 | HIGH |
| `@modelcontextprotocol/inspector` (npm) | `< 0.14.1` | `0.14.1` | CVE-2025-49596 | MCP Inspector unauthenticated RCE — proxy accepts arbitrary stdio commands from the browser | CWE-94 | CRITICAL |
| `mcp-remote` (npm) | vuln range — verify | per advisory | CVE-2025-6514 | OS command injection via crafted MCP server params | CWE-78 | CRITICAL |
| `next` (npm) | `< 12.3.5` / `< 13.5.9` / `< 14.2.25` / `< 15.2.3` | per branch | CVE-2025-29927 | `x-middleware-subrequest` header blindly trusted → middleware (incl. auth) skipped | CWE-285 | HIGH |
| `PyYAML` (PyPI) | `FullLoader`/`UnsafeLoader` usage (all versions) | n/a — code fix | CVE-2026-24009 (Docling) | `FullLoader` is **NOT safe**; still constructs arbitrary objects. Switch to `SafeLoader` | CWE-502 | CRITICAL |
| `torch` (PyPI) | `< 2.10.0` even with `weights_only=True` | `2.10.0` | CVE-2026-24747 | `torch.load(weights_only=True)` restricted-unpickler bypass via malformed opcodes; prefer `safetensors` | CWE-502 | HIGH |

### Notes per entry

- **LangChain (CVE-2025-68664 / -68665).** Python fix lines diverge:
  `0.3.x` users go to `0.3.81`, `1.x` users to `1.2.5`. The JS package
  (`@langchain/core`) is a separate advisory — confirm its exact vulnerable
  range on NVD/Snyk; the research source did not pin a clean threshold.
- **MCP Inspector (CVE-2025-49596) / mcp-remote (CVE-2025-6514).** Both are
  part of the 2025 MCP RCE cluster. mcp-remote's clean fixed version was not
  pinned in the research source — **verify the exact fixed release on NVD**
  before quoting a threshold.
- **Next.js (CVE-2025-29927).** Reference anchor for the matcher-evasion /
  middleware-bypass class. Multiple maintained branches each have their own
  fix; pick the threshold matching the project's major.
- **PyYAML (CVE-2026-24009).** This is a *false-safety correction*, not a
  simple version pin: `FullLoader` was widely believed safe. The detector is
  the **call-site** (`Loader=yaml.FullLoader` / `yaml.unsafe_load`), not the
  PyYAML version. Listed here so SCA logic knows version-bumping PyYAML does
  not fix it — the code must move to `SafeLoader`.
- **torch (CVE-2026-24747).** `weights_only=True` was the documented "safe"
  path; it was bypassable below `2.10.0`. Flag `torch.load` regardless of the
  flag when `torch < 2.10`; recommend `safetensors`.

---

Cross-reference: deserialization call-site detection lives in
`cat-08-injection-ssrf.md`; agentic/LLM-package detection in
`cat-11-mcp-agentic.md`; supply-chain manifest/lockfile detection in
`cat-10-supply-chain.md`. CWE definitions in `lib/cwe-map.json`.
