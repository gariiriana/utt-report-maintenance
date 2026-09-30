# Deep Dive #10 — Supply Chain & CI/CD Integrity

**Category.** `supply_chain`.

**Gate.** Always run. (Partition-level fan-out gate: run when the partition
contains ANY of a package manifest — `package.json`, `pyproject.toml`/
`setup.py`, `Cargo.toml`, `*.gemspec`, `go.mod`, `pom.xml`/`build.gradle` —
a lockfile, a CI workflow (`.github/workflows/`, `.gitlab-ci.yml`,
`.circleci/`, `Jenkinsfile`, `azure-pipelines.yml`), a `Dockerfile`, or
Terraform/OpenTofu `*.tf`. Gate reason when absent:
`"no package manifests, CI workflows, containers, or IaC in partition"`.)

**OWASP tags.**
- Web Top 10 (2025): `A03:2025` — Software Supply Chain Failures.
- In prose, also map pipeline findings to OWASP **CI/CD Security Top-10**
  (CICD-SEC-3 Dependency Chain Abuse, CICD-SEC-4 Poisoned Pipeline
  Execution, CICD-SEC-6 Insufficient Credential Hygiene). **Do NOT** put
  `CICD-SEC-#` in `owasp_ids` — the schema only accepts ASVS-V#.#.# /
  API#:YYYY / LLM##:YYYY / A##:YYYY / ASI##:YYYY. Use `A03:2025` there and
  cite CICD-SEC in the `description`/`notes`.

**Baseline CWEs:** 78, 94, 494, 506, 798, 829, 1104, 1357, 1395.

**Boundary with cat-07 (deployment).** cat-07 owns Dockerfile / k8s /
Terraform *misconfiguration* (hadolint, etc.). cat-10 owns the
*supply-chain dimension*: provenance, pinning-as-integrity, malicious
dependencies. When both could fire on a `FROM ...:latest` line, cat-10
files the provenance/pinning finding and references cat-07; do not
double-report the same root cause.

**SCA version-threshold.** For known-vulnerable framework/library versions,
consult `lib/known-vuln-versions.md` (LangChain, MCP Inspector, mcp-remote,
Next.js, PyYAML, torch). That file is also consumed by `cat-11-mcp-agentic.md`.
Cross-reference `osv-scanner` (Phase 4) output and prefer it as the live
SCA signal; the known-vuln table is a curated backstop. Every CVE there
must be NVD-verified before it ships in a finding.

---

## Invariants

1. Install/lifecycle hooks (`preinstall`/`postinstall`/`prepare`,
   `setup.py` cmdclass, `.pth` files, `build.rs`, `extconf.rb`) do not run
   network fetches, obfuscated payloads, or arbitrary process execution.
2. Every dependency resolves from an expected registry; lockfile entries
   carry integrity hashes and the resolved host is not a look-alike / raw IP.
3. Internal-looking scoped packages are scope-locked to a private registry;
   no inflated "resolution-winning" versions slip into manifests.
4. CI workflows do not interpolate untrusted `github.event.*` text into
   `run:` blocks, and do not check out untrusted PR head code under a
   privileged trigger (`pull_request_target` / `workflow_run`).
5. Third-party actions are pinned to a 40-hex commit SHA, not a mutable
   tag/branch (`@v3`, `@main`, `@latest`).
6. Self-hosted runner registration is intentional and locked down (the
   Shai-Hulud runner-registration vector).
7. Publishing uses OIDC trusted publishing / short-lived tokens with
   provenance/attestation; long-lived publish tokens in CI are flagged.

## Detection patterns

### A. Malicious lifecycle / install hooks (CWE-506, CWE-829)

npm manifest hooks in `package.json` — presence is INFO; escalate on body.
```
"(preinstall|postinstall|install|prepare)"\s*:
```
→ **INFO** / CWE-1395 / `A03:2025` (baseline; the hook merely exists).

Hook body (or any install script) containing fetch / exec / obfuscation:
```
(preinstall|postinstall|prepare)[^\n]{0,200}(curl|wget|Invoke-WebRequest|node\s+-e|child_process|eval\(|atob\(|base64\s+-d|setup_bun|bun_environment)
https?://(?!registry\.npmjs\.org)[a-z0-9.-]+[^\n"']{0,80}\|\s*(sh|bash|node)
setup_bun\.js|bun_environment\.js
```
→ **HIGH** / CWE-506 / `A03:2025` (Shai-Hulud 2.0 `setup_bun`/`bun_environment`
is the named IOC; CICD-SEC-4 Poisoned Pipeline Execution).

Python build/startup hooks — `setup.py` running code, `.pth` import hooks,
non-standard build backend:
```
cmdclass\s*=\s*\{
__import__\s*\(\s*['"](os|subprocess|socket|urllib)['"]
^\s*import\s+\w+\s*;\s*\w+\.(system|popen|exec|connect)
build-backend\s*=\s*['"](?!setuptools|hatchling|flit_core|poetry)
```
→ **HIGH** / CWE-506 / `A03:2025`. (LiteLLM `.pth` IOC `litellm_init.pth`
runs at interpreter start — the `.pth`-with-`import` shape is the signal.)

Rust `build.rs` doing process / network / decode-exec work:
```
build\.rs[^\n]{0,200}(std::process::Command|reqwest|ureq|std::net|include_bytes!)
```
→ **HIGH** / CWE-506 / `A03:2025` (TrapDoor `build.rs` vector).

Ruby native-extension hook `extconf.rb` doing more than `create_makefile`:
```
extconf\.rb[^\n]{0,200}(system\(|Net::HTTP|Base64\.decode64|eval\(|`)
```
→ **HIGH** / CWE-506 / `A03:2025` (BufferZoneCorp `extconf.rb` vector).

### B. Dependency confusion / typosquatting (CWE-494, CWE-1357)

Inflated "resolution-winning" version (major ≥ ~90):
```
"\^?(9\d|[1-9]\d{2,})\.\d{1,}\.\d{1,}"
"(100|999|9999)\.\d+\.\d+"
```
→ **HIGH** / CWE-494 / `A03:2025` (e.g. `100.100.100`, `9999.x`; the
May-2026 dependency-confusion campaign signal).

Lockfile resolved-URL host not the public registry (run `lockfile-lint`
too — wrap, don't reimplement):
```
"resolved"\s*:\s*"https?://(?!registry\.npmjs\.org)[^"]+"
"resolved"\s*:\s*"https?://\d{1,3}(\.\d{1,3}){3}
```
→ **MEDIUM** / CWE-1357 / `A03:2025` (HIGH if the host is a raw IP, a URL
shortener, or a look-alike domain — escalate by hand).

Lockfile entry missing an integrity hash:
```
"resolved"\s*:\s*"[^"]+"(?![^}]*"integrity")
```
→ **MEDIUM** / CWE-1357 / `A03:2025` (absent/altered integrity hash;
mismatch-vs-disk needs a fetch — delegate to `osv-scanner`/`npm ci`).

Internal-looking scoped package (manifest) — confirm a private-registry
scope mapping exists in `.npmrc`; absence is the finding:
```
"@[a-z0-9][a-z0-9-]+/[a-z0-9][\w.-]*"\s*:\s*"[~^]?\d
@[a-z0-9][a-z0-9-]+:registry=
```
The first matches a scoped dep; the second is the `.npmrc` scope→registry
lock. A scoped internal dep with **no** matching `.npmrc` lock →
**HIGH** / CWE-1357 / `A03:2025` (CICD-SEC-3 Dependency Chain Abuse).

### C. CI script-injection & untrusted checkout (CWE-94, CWE-829)

Untrusted `github.event.*` interpolated into a `run:` step (template
injection — `zizmor template-injection` covers most; this is a backstop):
```
\$\{\{\s*github\.event\.(issue|pull_request|comment|discussion|review|head_commit)\.[\w.]*(title|body|message)[\w.]*\s*\}\}
\$\{\{\s*github\.event\.discussion\.body\s*\}\}
```
→ **CRITICAL** / CWE-94 / `A03:2025` (the `discussion.body` form is the
Shai-Hulud 2.0 IOC; CICD-SEC-4 Poisoned Pipeline Execution).

Privileged trigger + checkout of untrusted PR head (tj-actions class):
```
on:\s*\[?[^\]\n]*(pull_request_target|workflow_run)
ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.(sha|ref)\s*\}\}
```
A `pull_request_target`/`workflow_run` trigger **combined with** an
`actions/checkout` of `github.event.pull_request.head.*` →
**CRITICAL** / CWE-829 / `A03:2025` (`zizmor dangerous-triggers`).

Unpinned / mutable action ref (not a 40-hex SHA):
```
uses:\s*[\w.-]+/[\w.-]+@(v?\d+(\.\d+)*|main|master|HEAD|latest)\s*$
```
→ **MEDIUM** / CWE-1104 / `A03:2025` (HIGH for third-party orgs; the
tj-actions / Trivy mutable-tag re-point disaster. `zizmor unpinned-uses`).

Self-hosted runner usage / registration (Shai-Hulud `SHA1HULUD` vector):
```
runs-on:\s*[\[\s]*['"]?self-hosted
actions/runner[^\n]{0,80}--token
config\.(sh|cmd)[^\n]{0,80}--url[^\n]{0,80}--token
```
→ **MEDIUM** / CWE-829 / `A03:2025` (context for runner-registration risk;
escalate if registration is scripted from an install hook / untrusted step).

### D. Provenance & publishing posture (CWE-798, CWE-347 in prose)

Positive signals — note when **ABSENT** from a publish workflow (reward
provenance; their absence is the maturity gap, not the vuln):
```
npm\s+publish[^\n]{0,80}--provenance
id-token:\s*write
actions/attest-build-provenance|cosign|sigstore|slsa-github-generator
```
Presence → **INFO** / CWE-1104 / `A03:2025` ("good posture"). Absence in a
release/publish workflow → downgrade to a maturity nudge, not a HIGH.

Long-lived publish token referenced in a publish step with **no** OIDC
`id-token: write` present (post-Dec-2025 classic-token revocation makes
this both risky and likely-broken):
```
(NPM_TOKEN|PYPI_TOKEN|CARGO_REGISTRY_TOKEN|TWINE_PASSWORD)\b
\$\{\{\s*secrets\.(NPM_TOKEN|PYPI_TOKEN|CARGO_REGISTRY_TOKEN)\s*\}\}
```
→ **MEDIUM** / CWE-798 / `A03:2025` (CICD-SEC-6 Insufficient Credential
Hygiene). If an OIDC `id-token: write` trusted-publishing block is present
in the same workflow, downgrade to LOW/INFO.

## False-positive notes

- **Lifecycle hooks are common and legitimate** (build steps, native
  compilation, husky). The bare-hook regex is INFO only; ship HIGH only on
  body signals (fetch/exec/obfuscation/`setup_bun`), never on presence.
- **`@scope/...` is not inherently internal** — `@types/*`, `@babel/*` are
  public. Flag only scoped deps that look corporate AND lack a
  private-registry scope lock; verify the scope isn't a known public one.
- **Inflated-version regex** can hit legitimate calendar-/high-major
  versions. Treat as `POSSIBLE` and confirm the real release history.
- **`v`-tagged first-party actions** (`actions/checkout@v4` from GitHub) are
  lower risk than third-party tags — flag MEDIUM not HIGH; SHA-pin regardless.
- **Self-hosted runners** are a normal enterprise pattern; the finding is
  context, escalated only when registration is scripted from untrusted input.
- **Provenance "good posture"** rows are INFO — positive signals that must
  not inflate severity counts.

## Output

`phase-05-supply_chain-<partition>.jsonl`.
