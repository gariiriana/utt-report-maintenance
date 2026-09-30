#!/usr/bin/env python3
"""
verify-deliverable.py — fail-closed gate on everything this skill writes into
the audited repository.

WHERE THIS RUNS
---------------
  * `steps/phase-07-synthesis.md §7.10` — before the `cp` of the report, SARIF
    and CycloneDX into `<output_dir>`.
  * `steps/phase-08-baseline.md §8.5` — before the pruned baseline `cp`.

    python3 "$SKILL_DIR/lib/verify-deliverable.py" --redact \
        --json-report .claude-audit/current/deliverable-gate.json \
        .claude-audit/current/phase-07-report.md \
        .claude-audit/current/findings.sarif \
        .claude-audit/current/findings.cyclonedx.json

WHY A SECOND LAYER EXISTS AT ALL
--------------------------------
`lib/redact-scanner-output.py` already strips scanner output structurally at
Phase 4 ingest, and that is the control that actually closes the v2.6.0 leak.
This gate is not a substitute for it. It exists because the structural strip
covers one directory — `phase-04-scanners/` — and the deliverables draw on a
second source it never sees: **prose an analyst wrote in Phases 5 to 7.**

`steps/deepdive/cat-06-secret-sprawl.md` hands a sub-agent regexes for locating
literal credentials, and `lib/report-template.md` prints `{{description}}` and
`{{attack_scenario}}` verbatim into a tracked markdown file. Nothing before
v2.6.1 stopped an analyst from pasting the matched value into the finding it
was reporting. A structural strip cannot help there: the field is free text and
the whole point of it is to be read.

So the layering is deliberate and the asymmetry is deliberate:

  * Phase 4 strip — whitelist, no detector list, cannot lose coverage.
  * This gate  — blocklist, incomplete by construction, catches prose.

A blocklist as the *only* control would be a coverage claim this table cannot
support. A blocklist as the *last* control is a tripwire, and a tripwire that
fires is a bug report.

WHY IT REDACTS RATHER THAN ABORTS
---------------------------------
Aborting the write is strictly safer and was rejected on the grounds that a
user three phases into a 45-minute audit will reach for whatever flag makes the
abort go away, and that flag then becomes the hole. Instead the gate scrubs,
writes, and forces a CRITICAL finding into the report (`--json-report` feeds
`phase-07-synthesis.md §7.10a`) that names this as a defect in the audit tool
rather than in the audited code. The user still gets their deliverables; the
failure is impossible to mistake for a finding about their own repository.

A firing gate means the Phase 4 strip did not hold. That is worth a bug report
upstream, and the emitted finding says so.

EXIT CODES
----------
  0  clean — nothing to redact
  1  `--check`: credential material present (nothing written)
  2  usage or I/O error
  3  `--redact`: material was found and scrubbed; caller MUST emit the
     CRITICAL self-finding described in §7.10a
"""

import argparse
import importlib.util
import json
import os
import sys
from collections import Counter

_LIB = os.path.dirname(os.path.abspath(__file__))

# Deliverables are text. Anything else that lands in <output_dir> is not
# something this gate can reason about, and is reported rather than skipped.
_TEXT_EXTS = (".md", ".json", ".sarif", ".txt", ".jsonl", ".yaml", ".yml", ".csv")

# Fixed context for gate fingerprints. They are deliberately NOT comparable to
# the ingest fingerprints in `redact-scanner-output.py` (different context
# salt): a gate hit is a bug report, not a triage artifact to correlate.
_GATE_CONTEXT = "deliverable-gate"

MAX_BYTES = 64 * 1024 * 1024


def _load_detectors():
    path = os.path.join(_LIB, "secret-detectors.py")
    if not os.path.exists(path):
        sys.stderr.write("ERROR: shared detector table missing at %s\n" % path)
        sys.exit(2)
    spec = importlib.util.spec_from_file_location("_audit_secret_detectors", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


SD = _load_detectors()


def scan_text(text):
    """Return [(line_no, detector, fingerprint, length)] for `text`.

    Never returns the matched value. This function's output is written to a
    JSON report that lands in the blackboard, and a gate that leaked the secret
    into its own evidence file would be the original bug wearing a hat.
    """
    hits = []
    if not text:
        return hits
    # Scan the WHOLE document, then derive line numbers from offsets. Scanning
    # line by line was the original shape and it silently defeated every
    # multi-line detector: a PEM block had its `-----BEGIN-----` header
    # redacted and every base64 body line copied through untouched.
    for detector, start, end, value in SD.scan(text):
        hits.append({
            "line": text.count("\n", 0, start) + 1,
            "detector": detector,
            "fingerprint": SD.fingerprint(value, _GATE_CONTEXT),
            "length": end - start,
        })
    return hits


def process(path, redact):
    """Scan one deliverable. Returns (hits, changed)."""
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        return [{"line": 0, "detector": None, "error": "unreadable: %s" % exc,
                 "fingerprint": "", "length": 0}], False

    if size > MAX_BYTES:
        # Fail closed and loudly: an unscanned deliverable must never be
        # reported as a clean one.
        return [{"line": 0, "detector": None, "error": "file_too_large",
                 "fingerprint": "", "length": size}], False

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError as exc:
        return [{"line": 0, "detector": None, "error": "unreadable: %s" % exc,
                 "fingerprint": "", "length": 0}], False

    hits = scan_text(text)
    if not hits or not redact:
        return hits, False

    scrubbed, _fired = SD.scrub(text, _GATE_CONTEXT)
    tmp = path + ".gate.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(scrubbed)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)
    return hits, True


def _collect(paths):
    files = []
    for path in paths:
        if os.path.isdir(path):
            for root, _dirs, names in os.walk(path):
                for name in sorted(names):
                    if name.endswith(_TEXT_EXTS):
                        files.append(os.path.join(root, name))
        elif os.path.exists(path):
            files.append(path)
        else:
            sys.stderr.write("WARNING: no such deliverable, skipping: %s\n" % path)
    return files


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="verify-deliverable.py",
        description="Fail-closed credential gate on audit deliverables.",
    )
    parser.add_argument("paths", nargs="+", help="deliverable files or directories")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true",
                      help="report only; exit 1 if material is present (default)")
    mode.add_argument("--redact", action="store_true",
                      help="scrub in place; exit 3 if anything was scrubbed")
    parser.add_argument("--json-report", metavar="PATH",
                        help="write the machine summary that §7.10a reads")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress the human summary on stdout")
    args = parser.parse_args(argv)

    files = _collect(args.paths)
    if not files:
        sys.stderr.write("ERROR: no deliverables found in: %s\n" % " ".join(args.paths))
        return 2

    findings, detectors, redacted_files, errors = {}, Counter(), [], []
    for path in files:
        hits, changed = process(path, args.redact)
        if hits:
            findings[path] = hits
            # `detector: None` rows are scan FAILURES (unreadable, too large),
            # not credential hits. Counting them as detector names would render
            # "file_too_large" as a credential type in the §7.10a finding.
            detectors.update(h["detector"] for h in hits if h.get("detector"))
            errors.extend({"file": path, "error": h["error"]}
                          for h in hits if h.get("error"))
        if changed:
            redacted_files.append(path)

    report = {
        "gate": "verify-deliverable",
        "mode": "redact" if args.redact else "check",
        "files_scanned": len(files),
        "files_with_material": len(findings),
        "files_redacted": len(redacted_files),
        "detectors": dict(sorted(detectors.items())),
        "total_occurrences": sum(
            1 for hits in findings.values() for h in hits if h.get("detector")),
        "scan_errors": errors,
        "findings": findings,
    }

    if args.json_report:
        try:
            parent = os.path.dirname(os.path.abspath(args.json_report))
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(args.json_report, "w", encoding="utf-8") as fh:
                json.dump(report, fh, indent=2)
                fh.write("\n")
        except OSError as exc:
            sys.stderr.write("ERROR: cannot write --json-report: %s\n" % exc)
            return 2

    if not args.quiet:
        if not findings:
            print("verify-deliverable: PASS — %d file(s) clean." % len(files))
        else:
            print("verify-deliverable: %d file(s) carried credential material."
                  % len(findings))
            for path, hits in sorted(findings.items()):
                for hit in hits:
                    print("  %s:%s  %s  fp=%s len=%s"
                          % (path, hit["line"],
                             hit.get("detector") or ("SCAN-ERROR: %s" % hit.get("error")),
                             hit["fingerprint"] or "-", hit["length"]))

    if not findings:
        return 0
    if args.redact:
        sys.stderr.write(
            "\nGATE FIRED: credential material reached the deliverable stage and was\n"
            "scrubbed. This is a DEFECT IN THE AUDIT SKILL, not a finding about the\n"
            "audited code — the Phase 4 ingest strip should have caught it first.\n"
            "Phase 7 MUST emit the CRITICAL self-finding (§7.10a) and the run MUST\n"
            "report it. Please file this upstream with the detector names above.\n"
        )
        return 3
    return 1


if __name__ == "__main__":
    sys.exit(main())
