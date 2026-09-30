# Scanner Bundle Reference

Companion to `steps/phase-04-scanners.md`. One section per tool. Install
hints are authoritative for `scripts/install-scanners.sh`.

## Required (always attempted)

### semgrep

- **Role.** Polyglot SAST with community ruleset.
- **Install.** `pip install semgrep` (any OS with Python ≥3.8). Pin version in CI.
- **Invoke (default, no telemetry).** `semgrep scan --config p/security-audit --config p/owasp-top-ten --config p/jwt --sarif -o phase-04-scanners/semgrep.sarif --timeout 600 --metrics=off`
- **Invoke (alternate, broader coverage).** `semgrep scan --config auto --sarif -o ... --timeout 600` — requires `--metrics=on` (semgrep's `auto` ruleset resolution sends telemetry). Opt-in only.
- **Invoke (offline / air-gapped — `AUDIT_SAST_RULES`).** If `AUDIT_SAST_RULES` is set to a local rules directory, scan against it instead of fetching `p/...` registry packs: `semgrep scan --config "$AUDIT_SAST_RULES" --sarif -o phase-04-scanners/semgrep.sarif --timeout 600 --metrics=off`. Stage any ruleset there — a checkout of `semgrep-rules` (LGPL-2.1) / `opengrep-rules` / your own. Fully offline, no registry dependency. `run-audit-in-container.sh` honors the same var and bind-mounts the dir read-only.
- **Key rules.** `p/ci`, `p/security-audit`, `p/owasp-top-ten`, `p/jwt`, `p/cryptography`, `p/ssrf`. Use `--config <pack>` to stack multiple.
- **License.** LGPL-2.1 CLI; community rule packs are free. For a **free, OSS, invoke-only** tool like this one, using the Semgrep CLI + community registry is unrestricted (the Semgrep Rules License only limits commercial/SaaS/competing use). **Opengrep** (the LGPL fork) was evaluated and **not adopted**: its only free ruleset (`opengrep-rules`) is archived/frozen at Dec-2024, so Semgrep's continuously-maintained community packs are the better default. See `AUDIT_SAST_RULES` above for offline/BYO-rules.
- **Exit.** Non-zero when findings exist; SARIF still written.

### osv-scanner

- **Role.** SCA across all manifest ecosystems (npm, pypi, maven, go mod, cargo, composer, ruby, nuget, pub, bazel).
- **Install.** Prebuilt binary from `github.com/google/osv-scanner/releases`. Apple Silicon / Linux x86_64 / arm64 available.
- **Invoke.** `osv-scanner scan --recursive --format sarif --output phase-04-scanners/osv.sarif .`
  - Syntax note: `scan source <path>` is accepted by older versions; 1.9.x+ uses positional `[directory]` after `scan`. The invocation above works across current versions.
- **License.** Apache-2.0.
- **Notes.** Auto-detects manifests. Repos without a lockfile (e.g., a checked-out tree without `npm install` having run) get near-zero coverage — warn the user and proceed. For reachability analysis (Go only), also run `govulncheck` (conditional).

### gitleaks

- **Role.** Secrets — working tree + git history.
- **Install.** Prebuilt binary from `github.com/gitleaks/gitleaks/releases`.
- **Invoke.**
  - Working tree (fast): `gitleaks detect --no-git --report-format sarif --report-path phase-04-scanners/gitleaks.sarif`
  - History (slow): `gitleaks git . --report-format sarif --report-path phase-04-scanners/gitleaks-history.sarif` (20 min timeout)
- **License.** MIT.

### trufflehog

- **Role.** Verified-secret sweep (validates credentials against vendor APIs).
- **Install.** `curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin` (read before running on your host).
- **Invoke.** `trufflehog git file://. --json --results=verified > phase-04-scanners/trufflehog.json`
  - Flag note: `--only-verified` is soft-deprecated as of trufflehog 3.88+ in
    favour of `--results=verified` (which also accepts `unknown`/`unverified`).
    `--only-verified` still works on 3.95.x but emits a deprecation notice;
    use `--results=verified`.
- **Output.** JSONL; convert to SARIF during post-processing.
- **Caveat.** `--results=verified` makes network calls to vendor APIs. Document this in the report's provenance section. A `--no-verification` alternative exists if outbound calls are disallowed.

### trivy

- **Role.** Dockerfile + IaC + vuln scanning + SBOM.
- **Install.** Prebuilt binary from `aquasecurity/trivy/releases` or `brew install trivy` / apt repo.
- **Invoke.**
  - Full repo: `trivy fs --scanners vuln,secret,misconfig,license --format sarif --output phase-04-scanners/trivy.sarif .`
  - IaC only: `trivy config -f sarif -o phase-04-scanners/trivy-iac.sarif .`
  - SBOM: `trivy fs --format cyclonedx -o phase-04-scanners/sbom.cyclonedx.json .`
- **License.** Apache-2.0.

### hadolint

- **Role.** Dockerfile lint.
- **Install.** Prebuilt binary from `github.com/hadolint/hadolint/releases` or `brew install hadolint`.
- **Invoke.** `find . -name Dockerfile -not -path './node_modules/*' | xargs -I {} hadolint --format sarif {} | jq -s '...'` then merge into one SARIF document.
- **License.** GPL-3.0.

## Conditional (gated by Phase 0 profile)

### brakeman (gate: Rails detected)

- **Install.** `gem install brakeman`.
- **Invoke.** `brakeman -f sarif -o phase-04-scanners/brakeman.sarif --no-progress --no-summary`
- **License.** MIT.

### checkov (gate: Terraform-heavy repo)

- **Install.** `pip install checkov`.
- **Invoke.** `checkov -d . --framework terraform -o sarif --output-file-path phase-04-scanners/checkov.sarif`
- **License.** Apache-2.0.

### kube-linter (gate: Kubernetes manifests present)

- **Install.** Prebuilt binary from `stackrox/kube-linter/releases`.
- **Invoke.** `kube-linter lint --format sarif ./... > phase-04-scanners/kube-linter.sarif`
- **License.** Apache-2.0.

### grype (optional — EPSS + KEV prioritization)

Promoted in v2.1 to a first-class prioritization input. grype's vulnerability
DB carries **EPSS** (exploit-probability) scores and **CISA KEV** (known-
exploited) flags; Phase 7 uses them to rank findings and stamps them onto the
matching SARIF results as `properties.epss` and `properties.kev`.

- **Install.** Prebuilt binary from `anchore/grype/releases`.
- **Invoke (SARIF, for findings).** `grype dir:. -o sarif > phase-04-scanners/grype.sarif`
- **Invoke (JSON, for EPSS/KEV).** `grype dir:. -o json > phase-04-scanners/grype.json`
  — Phase 7 reads `.matches[].vulnerability.epss[0].epss` (probability) and
  `.matches[].vulnerability.knownExploited` (KEV) and joins on CVE/GHSA id.
- **Synthesis use.** EPSS ≥ 0.10 or KEV=true on an otherwise-MEDIUM finding is
  surfaced in the report's "Exploit-likely" callout; EPSS/KEV never *lower*
  severity (prioritization only, additive — consistent with the ±1-rung cap).
- **License.** Apache-2.0.

### govulncheck (gate: Go detected)

- **Install.** `go install golang.org/x/vuln/cmd/govulncheck@latest`.
- **Invoke.** `govulncheck -format sarif ./... > phase-04-scanners/govulncheck.sarif`
- **Notes.** Adds reachability — a dependency CVE only counts if the vulnerable symbol is actually called.
- **License.** BSD-3.

### psalm (gate: PHP detected)

- **Install.** `composer require --dev vimeo/psalm`, then `./vendor/bin/psalm --init`.
- **Invoke.** `./vendor/bin/psalm --taint-analysis --report=phase-04-scanners/psalm.sarif`
  - Flag note: psalm writes SARIF via `--report=<file>.sarif` (format inferred
    from the `.sarif` extension), **not** `--output-format=sarif` — `sarif` is
    not a valid `--output-format` value (that flag controls console output).
- **License.** MIT.

### zizmor (gate: `.github/workflows/*.yml` present)

- **Install.** Prebuilt binary from `zizmorcore/zizmor/releases` (Rust). The
  project moved from `woodruffw/zizmor` to the `zizmorcore` org; the old repo
  redirects but pin the new path. `cargo install zizmor` also works.
- **Invoke.** `zizmor --format=sarif . > phase-04-scanners/zizmor.sarif`
  - Flag note: recent zizmor expects `--format=sarif` (the `=` form). Verify
    `zizmor --help` against the installed version if SARIF output is empty.
- **License.** MIT.

## Excluded by default (documented in README)

### CodeQL

Excluded by default because the CLI is license-restricted to OSI-approved
OSS repositories. Users on eligible repos can enable it manually; see
README section "Licensing & attribution". When enabled, the invocation
lives in the M7 README.

### Snyk, Checkmarx, Veracode

Paid. Out of scope for this open-source skill. Findings from these tools
can be ingested post-hoc if the user separately runs them — any SARIF in
`phase-04-scanners/*.sarif` is picked up by Phase 7 synthesis.

## Tool-version pinning

The installer does **not** pin scanner versions by default — most scanners
ship frequent rule updates and users benefit from the freshest rules. CI
users who want reproducibility should pin in their Dockerfile or via
`requirements.txt` / Brewfile.
