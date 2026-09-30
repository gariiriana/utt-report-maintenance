# SARIF Post-Processing

Rules for producing the slim, Phase 5-7-friendly JSON from each scanner's
SARIF output.

## Why slim?

SARIF 2.1.0 carries ~15-20 fields per finding, many of which describe
provenance (tool config, invocation command, fingerprints, artifact
content flows). Phase 7 needs only: which rule fired, at what file and
line, what severity, what the message was. Stripping early saves ~80%
of downstream context budget.

The raw SARIF is **kept on disk** at `phase-04-scanners/<tool>.sarif` so
users who want to upload to GitHub's Security tab / DefectDojo / Jira
still have the full document.

⚠ **"Raw" means un-slimmed, not un-redacted.** Every file in
`phase-04-scanners/` has already been through
[`redact-scanner-output.py`](redact-scanner-output.py) at
`steps/phase-04-scanners.md §4.4b`, which removes `snippet` / `contents` /
`insertedContent` from every run. The slim step below is not what protects
credentials — it happens to discard `snippet`, and relying on that side effect
is what let v2.6.0 ship a live token to a tracked deliverable, because the
consolidated SARIF in `phase-07-synthesis.md §7.8.1` is assembled from the raw
documents and never passes through here at all. Do not treat this file as a
security control.

**Empirical compression** (measured on the M3 Juice Shop dogfood — see
`docs/test-runs/m3-*.md`): semgrep 1.4MB → 14KB (99.0% reduction),
gitleaks 83KB → 15KB (82.2%), gitleaks-history 93KB → 17KB (81.3%). The
80% lower bound in our earlier estimate holds; semgrep's richer per-result
metadata compresses better than single-secret scanner output.

## Slim schema (`<tool>.slim.json`)

```json
{
  "tool": "semgrep",
  "tool_version": "1.82.0",
  "audit_id": "...",
  "results": [
    {
      "rule_id": "python.flask.security.audit.render-template-with-variable",
      "rule_short": "render-template-with-variable",
      "level": "error",
      "file": "app/views.py",
      "start_line": 42,
      "end_line": 42,
      "message": "Use of user-controlled template variable...",
      "secret_fingerprint": null
    }
  ]
}
```

- `level`: the scanner's severity — `error|warning|note|none` (SARIF's set).
  Phase 7 maps these to CRITICAL/HIGH/MEDIUM/LOW/INFO via a rubric (see
  §"Severity mapping" below).
- `rule_short`: last dotted segment of `rule_id` for display.

Discarded from SARIF: `fingerprints`, `fixes`, `codeFlows`, `properties`,
`ruleIndex`, `taxa`, `artifacts`, `invocations`, `tool.driver.rules`,
`message.markdown`, `partialFingerprints`.

Carried through when present (added v2.6.1): `properties.secret_fingerprint` —
the stable, non-reversible id `§4.4b` leaves in place of a redacted secret. It
is what lets a secret finding dedupe in Phase 7 and carry forward in the
Phase 8 baseline now that the value itself is gone.

## Mapping procedure

For each file in `phase-04-scanners/*.sarif`:

```text
slim = { tool: sarif.runs[0].tool.driver.name,
         tool_version: sarif.runs[0].tool.driver.version,
         audit_id: <profile.audit_id>,
         results: [] }

for run in sarif.runs:
  for result in run.results:
    location = result.locations[0].physicalLocation
    slim.results.append({
      rule_id:    result.ruleId,
      rule_short: result.ruleId.split('.').last,
      level:      result.level || "warning",
      file:       location.artifactLocation.uri,
      start_line: location.region.startLine,
      end_line:   location.region.endLine || location.region.startLine,
      message:    result.message.text
    })
```

Edge cases:

- Missing `locations` → use `null` for file/line; set `rule_short` to rule_id.
- `message.text` with embedded newlines → collapse to a single space.
- Absolute paths in `artifactLocation.uri` → rewrite to repo-relative.
- Scanner emits multiple locations per finding → take `locations[0]`,
  record additional locations in a `related_locations[]` array only if the
  count is ≤3 (else drop).

## Severity mapping (applied in Phase 7, not here)

| SARIF level | Default Phase 7 severity |
|---|---|
| `error` | HIGH |
| `warning` | MEDIUM |
| `note` | LOW |
| `none` | INFO |

Scanner-specific overrides (applied per tool): semgrep rules tagged
`security-severity: critical` → CRITICAL; osv-scanner CVEs with CVSS ≥9.0
→ CRITICAL; trivy findings with `severity: CRITICAL` → CRITICAL; etc.
Phase 7 reads scanner-specific fields that the slim form preserves in a
`raw_severity` overflow field when present.

## Trufflehog JSONL → Slim SARIF

Trufflehog does not emit SARIF natively. Convert:

```text
for line in trufflehog.json:
  entry = json.parse(line)
  slim.results.append({
    rule_id:    "trufflehog." + entry.detector_name,
    rule_short: entry.detector_name,
    level:      "error" if entry.verified else "warning",
    file:       entry.source.git.file || entry.source.url,
    start_line: entry.source.git.line || 0,
    message:    "verified " + entry.detector_name + " secret found",
    secret_fingerprint: entry.SecretFingerprint          # set by §4.4b
  })
```

⚠ Never map `entry.Raw` / `entry.RawV2` / `entry.Redacted` into the slim form
or the message. `verified: true` means trufflehog authenticated the credential
against the live provider — these are the highest-value secrets in the run, and
`§4.4b` has already replaced all three fields with markers. Use
`entry.SecretFingerprint`.

Only rows with `verified: true` by default. A user can re-run Phase 4
with `--include-unverified` (M7 argument) to widen the sweep.

## Hadolint multi-file aggregation

When `find | hadolint` is run once per Dockerfile, merge the emitted
SARIF docs into a single slim form. Keep each finding's `file` distinct;
do not deduplicate across Dockerfiles (different Dockerfile, different
finding site).
