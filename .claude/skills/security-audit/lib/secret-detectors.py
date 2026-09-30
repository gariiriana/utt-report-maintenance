#!/usr/bin/env python3
"""
secret-detectors.py — the single source of truth for what this skill treats as
credential material.

WHY THIS EXISTS
---------------
Through v2.6.0 this skill wrote live credentials into the repository it was
auditing. The chain was four links long and every link was working as designed:

  1. `phase-04-scanners.md` runs `gitleaks detect --no-git`, which deliberately
     ignores `.gitignore` — that is where uncommitted secrets live. gitleaks
     SARIF carries the matched secret verbatim in `region.snippet.text`.
     trufflehog runs `--results=verified`, so every hit is a credential the
     scanner *proved* was live.
  2. `phase-07-synthesis.md §7.8.1` assembles `findings.sarif` as one run per
     scanner plus one synthetic run, and instructs: per-scanner runs are
     "copied through *verbatim* — do NOT rewrite". The snippets came along.
  3. `phase-07-synthesis.md §7.10` copies that document to `<output_dir>`.
  4. `lib/output-routing.md` defaults `<output_dir>` to
     `docs/security-audit-output/` and calls it "tracked".

Net effect: a secret the audited project had correctly kept OUT of git was read
from a gitignored path and committed by the audit. The audit was the sole
reason the credential entered version control. `workflow.md` preflight
gitignores `.claude-audit/` but never `<output_dir>`, so the protection sat on
the working directory and not on the one that gets committed.

TWO ENFORCERS CONSUME THIS TABLE
--------------------------------
  * `lib/redact-scanner-output.py` — Phase 4 ingest strip (structural)
  * `lib/verify-deliverable.py`    — Phase 7/8 write gate (pattern tripwire)

They MUST share one table. Two copies drift, and the day they drift the gate
stops matching the redactor — a control whose enforcer no longer covers it,
which is the exact defect class this skill exists to detect. `tests/
test-secret-redaction.sh` asserts both enforcers resolve THIS module.

WHY PATTERNS ARE THE SECOND LINE AND NOT THE FIRST
--------------------------------------------------
This table is a blocklist, and a blocklist racing gitleaks' ~170 detectors
loses. It is not the primary control. The primary control is structural:
`redact-scanner-output.py` removes `snippet` / `contents` / `insertedContent`
from EVERY scanner run unconditionally, because nothing downstream in this
skill reads them (the slim form at `lib/sarif-postprocess.md` already discards
snippets, Phase 5-7 never touch them, and `tests/e2e/assertions.py:
_sarif_result_to_finding` keys on `ruleId` and `properties`). Removing a field
no consumer reads cannot lose coverage and needs no detector list.

These patterns exist for the residue the structural strip cannot reach: free
text. Scanner `message.text`, invocation command lines, and — the case that
matters most — prose an analyst wrote into a finding `description`.
"""

import hashlib
import math
import re

# ---------------------------------------------------------------------------
# Fingerprinting
# ---------------------------------------------------------------------------

# Domain separation. A bare sha256 of a low-entropy secret ("hunter2") is a
# rainbow-table lookup, and publishing one in a tracked deliverable would trade
# a credential leak for a slower credential leak. Salting with a fixed domain
# string plus the detector/rule context makes a generic precomputed table
# useless: an attacker must build one per rule id. It does NOT make a targeted
# guess against a known-weak secret expensive, and it is not meant to — see
# `lib/secret-redaction.md` §"What the fingerprint is not".
_FP_DOMAIN = b"claude-security-audit/secret-fp/v1\x00"

FINGERPRINT_LEN = 16


def fingerprint(value, context=""):
    """Stable, non-reversible id for a secret occurrence.

    Stable across runs for the same (context, value) pair, which is what lets
    Phase 7 dedupe and Phase 8 carry a secret finding forward in the baseline
    without ever holding the value.
    """
    h = hashlib.sha256()
    h.update(_FP_DOMAIN)
    h.update(context.encode("utf-8", "replace"))
    h.update(b"\x00")
    h.update(value.encode("utf-8", "replace"))
    return h.hexdigest()[:FINGERPRINT_LEN]


def marker(detector, value, context=""):
    """The replacement text written in place of credential material.

    Carries everything triage needs (which detector fired, a stable id, how
    long the value was) and nothing an attacker can spend.
    """
    return "[REDACTED:%s:%s:len%d]" % (detector, fingerprint(value, context), len(value))


# Anything already carrying our marker must never be re-flagged, or `--check`
# fails on a file the redactor just cleaned and the gate deadlocks.
MARKER_RE = re.compile(r"\[REDACTED:[a-z0-9_]+:[0-9a-f]{%d}:len\d+\]" % FINGERPRINT_LEN)


# ---------------------------------------------------------------------------
# Detector table
# ---------------------------------------------------------------------------
#
# (name, pattern, value_group, entropy_gated)
#
# value_group 0 means the whole match is the secret. A non-zero group means the
# pattern needs surrounding context to fire (an assignment, a header) and only
# the captured group is credential material.
#
# entropy_gated detectors run the placeholder + entropy filter before firing.
# Prefix-anchored detectors (ghp_, AKIA, xox…) do not: the prefix IS the
# evidence, and a real token that happens to look low-entropy still spends.

_RAW_DETECTORS = [
    # --- asymmetric key material -------------------------------------------
    # The BLOCK pattern must come first and must stay first. Matching only the
    # `-----BEGIN ... -----` header redacted the header and left every base64
    # body line in place, which is the entire key. `scan()` resolves overlaps
    # longest-match-wins at the same start offset, so the block beats the
    # header whenever an END marker exists.
    ("private_key",
     r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----"
     r"[\s\S]*?"
     r"-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----",
     0, False),
    # Truncated paste: a header with no closing marker. Redacts what is there
    # rather than nothing, and keeps the header itself out of the deliverable.
    ("private_key_header",
     r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----",
     0, False),

    # --- prefix-anchored vendor tokens -------------------------------------
    ("github_pat",
     r"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
     0, False),
    ("github_pat_fine_grained",
     r"\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\b",
     0, False),
    ("anthropic_key",
     r"\bsk-ant-[A-Za-z0-9_\-]{24,}",
     0, False),
    ("openai_key",
     r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}",
     0, False),
    ("aws_access_key_id",
     r"\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA)[A-Z0-9]{16}\b",
     0, False),
    ("gcp_api_key",
     r"\bAIza[A-Za-z0-9_\-]{35}\b",
     0, False),
    ("slack_token",
     r"\bxox[baprse]-[A-Za-z0-9\-]{10,}",
     0, False),
    ("slack_webhook",
     r"https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+",
     0, False),
    ("stripe_key",
     r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b",
     0, False),
    ("gitlab_pat",
     r"\bglpat-[A-Za-z0-9_\-]{20,}\b",
     0, False),
    ("npm_token",
     r"\bnpm_[A-Za-z0-9]{36}\b",
     0, False),
    ("pypi_token",
     r"\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_\-]{50,}",
     0, False),
    ("jwt",
     r"\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}",
     0, False),

    # --- context-required, entropy-gated -----------------------------------
    ("aws_secret_access_key",
     r"(?i)aws[^\n]{0,40}?[\"']([A-Za-z0-9/+=]{40})[\"']",
     1, True),
    ("azure_client_secret",
     r"(?i)(?:client[_-]?secret|azure[_-]?client[_-]?secret)[\"']?\s*[:=]\s*[\"']?([A-Za-z0-9~._\-]{30,})",
     1, True),
    ("basic_auth_url",
     r"://[A-Za-z0-9._%\-]+:([^@\s/\"']{8,})@",
     1, True),
    ("authorization_header",
     r"(?i)authorization[\"']?\s*[:=]\s*[\"']?(?:bearer|basic|token)\s+([A-Za-z0-9._\-+/=]{16,})",
     1, True),
    ("generic_secret_assignment",
     r"(?i)\b(?:api[_-]?key|apikey|secret|secret[_-]?key|access[_-]?token|auth[_-]?token"
     r"|password|passwd|pwd|credential|private[_-]?token)[\"']?\s*[:=]\s*[\"']([^\"'\s]{16,})[\"']",
     1, True),
]

DETECTORS = [(n, re.compile(p), g, e) for (n, p, g, e) in _RAW_DETECTORS]

DETECTOR_NAMES = tuple(n for (n, _p, _g, _e) in _RAW_DETECTORS)


# ---------------------------------------------------------------------------
# Placeholder + entropy filtering
# ---------------------------------------------------------------------------

_PLACEHOLDER_PREFIXES = (
    "your", "my-", "the-", "example", "placeholder", "changeme", "change-me",
    "change_me", "replaceme", "replace-me", "replace_me", "dummy", "sample",
    "fake", "insert", "todo", "fixme", "redacted", "scrubbed", "masked",
    "notreal", "no-secret", "xxx", "abc123", "foobar", "lorem",
)

_TEMPLATE_RE = re.compile(r"^[<\[{$%]|\$\{|\{\{|%\(|\$\(|<%")

# Shannon entropy floor, bits per character. A 40-char base64 AWS secret sits
# near 5.0; "hunter2hunter2hunter2" near 2.8; "aaaaaaaaaaaaaaaa" at 0.0.
ENTROPY_FLOOR = 3.0


def shannon_entropy(value):
    if not value:
        return 0.0
    counts = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    n = float(len(value))
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def is_placeholder(value):
    """True when the value is documentation furniture, not a credential."""
    if not value:
        return True
    if MARKER_RE.search(value) or "REDACTED" in value:
        return True
    low = value.strip().strip("\"'").lower()
    if not low:
        return True
    if low.startswith(_PLACEHOLDER_PREFIXES):
        return True
    if _TEMPLATE_RE.search(low):
        return True
    # Fewer than five distinct characters is a filler run ("xxxxxxxx", "0000…").
    if len(set(low)) < 5:
        return True
    return False


def _fires(detector_name, value, entropy_gated):
    if is_placeholder(value):
        return False
    if entropy_gated and shannon_entropy(value) < ENTROPY_FLOOR:
        return False
    return True


# ---------------------------------------------------------------------------
# Scan / scrub
# ---------------------------------------------------------------------------

def scan(text):
    """Return non-overlapping [(detector, start, end, value)] over `text`.

    Ordered by position. Overlaps are resolved longest-match-wins so a
    `generic_secret_assignment` hit never splits a `github_pat` hit, and so the
    `private_key` block beats the `private_key_header` that starts at the same
    offset.

    `text` MUST be the whole document, never one line at a time: `private_key`
    spans lines, and feeding this function line by line silently reduces it to
    the header-only match it used to be.
    """
    if not text:
        return []
    hits = []
    for name, rx, group, entropy_gated in DETECTORS:
        for m in rx.finditer(text):
            try:
                value = m.group(group)
            except IndexError:  # pragma: no cover - malformed detector entry
                continue
            if value is None:
                continue
            if not _fires(name, value, entropy_gated):
                continue
            hits.append((name, m.start(group), m.end(group), value))

    hits.sort(key=lambda h: (h[1], -(h[2] - h[1])))
    out, cursor = [], -1
    for hit in hits:
        if hit[1] < cursor:
            continue
        out.append(hit)
        cursor = hit[2]
    return out


def scrub(text, context=""):
    """Replace every credential occurrence in `text` with a marker.

    Returns (scrubbed_text, [detector_names]). An empty list means the text was
    already clean and the caller should leave the original object untouched.
    """
    if not isinstance(text, str) or not text:
        return text, []
    hits = scan(text)
    if not hits:
        return text, []
    parts, last, fired = [], 0, []
    for name, start, end, value in hits:
        parts.append(text[last:start])
        parts.append(marker(name, value, context))
        fired.append(name)
        last = end
    parts.append(text[last:])
    return "".join(parts), fired


__all__ = [
    "DETECTORS", "DETECTOR_NAMES", "ENTROPY_FLOOR", "FINGERPRINT_LEN",
    "MARKER_RE", "fingerprint", "is_placeholder", "marker", "scan", "scrub",
    "shannon_entropy",
]
