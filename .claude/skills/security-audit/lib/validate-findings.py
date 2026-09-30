#!/usr/bin/env python3
"""
validate-findings.py — validate JSONL findings against a JSON Schema.

Every Phase 5 deep-dive sub-agent and Phase 6 methodology sub-agent
MUST run this before emitting its RETURN SHAPE. See `--help` for usage.

Exit codes:
  0  all rows valid
  1  at least one row failed validation (stderr prints which)
  2  argparse / I/O error

Dependencies:
  - jsonschema (pip install jsonschema). Falls back to a permissive
    manual check if jsonschema is missing (so the skill still runs in
    minimal environments; CI MUST have jsonschema installed).
"""
import argparse
import json
import re
import sys
from pathlib import Path

_CITE_RE = re.compile(r"[\w./\\-]+\.\w+:\d+")

_CAP_GRAMMAR = re.compile(r"^[a-z][a-z0-9_]*(:[a-z0-9_]+)?$")


def load_schema(schema_path: Path) -> dict:
    with open(schema_path) as f:
        return json.load(f)


def iter_findings(jsonl_path: Path):
    with open(jsonl_path) as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield lineno, json.loads(line)
            except json.JSONDecodeError as e:
                yield lineno, {"__parse_error__": str(e), "__raw__": line[:200]}


def load_cwe_map(cwe_map_path: Path | None) -> set[str] | None:
    """Load the set of CWE IDs from cwe-map.json. Returns None if path
    is None (meaning: skip the semantic CWE-in-map check).

    Fails loudly if the file lacks a `mappings` object or the object
    is empty — this defends against a silent no-op semantic check
    caused by a schema refactor that renames the top-level key."""
    if cwe_map_path is None:
        return None
    with open(cwe_map_path) as f:
        doc = json.load(f)
    if "mappings" not in doc:
        raise ValueError(
            f"{cwe_map_path}: missing top-level `mappings` object. "
            "If you refactored the schema, update validate-findings.py "
            "too — the silent empty-set fallback has been removed."
        )
    mappings = doc["mappings"]
    if not isinstance(mappings, dict) or not mappings:
        raise ValueError(
            f"{cwe_map_path}: `mappings` must be a non-empty object. "
            "An empty map would pass every finding through the semantic "
            "check trivially — failing loudly instead."
        )
    return set(mappings.keys())


def capability_errors(lineno: int, finding: dict, require_cats: set[str]) -> list[str]:
    """Access-control findings must declare what an attacker needs and what they
    gain, or the Phase-7 attack-path arithmetic has nothing to compose.

    `preconditions` may legitimately be empty (that is the strong claim:
    anonymous-reachable) but must be PRESENT. `postconditions` must be non-empty
    — a finding that grants the attacker nothing is not a finding.

    See lib/capability-lexicon.md. The historical cost of leaving this in prose
    was a CONFIRMED finding rated one rung below the HIGH it chained to, and 96
    days of exposure."""
    if not require_cats or finding.get("category") not in require_cats:
        return []
    # v2.6: a REFUTATION grants the attacker nothing — that is the whole content
    # of the claim. Requiring non-empty `postconditions` here would force the
    # analyst to tag it with the capability the *alleged* defect would have
    # granted, feeding a **disproven** capability into the composition graph,
    # where it would satisfy other findings' preconditions and escalate them.
    # A refuted finding must be able to carry its real category and grant
    # nothing; `refutation_scope` (checked separately) is what keeps it honest.
    if finding.get("attacked") == "refuted":
        return []
    errs = []
    if "preconditions" not in finding:
        errs.append(
            f"line {lineno}: category `{finding.get('category')}` requires "
            "`preconditions` (use [] for anonymous-reachable) — see "
            "lib/capability-lexicon.md")
    post = finding.get("postconditions")
    if not post:
        errs.append(
            f"line {lineno}: category `{finding.get('category')}` requires a "
            "non-empty `postconditions` — state what the attacker gains "
            "(e.g. [\"knows:any_deck_id\"]); see lib/capability-lexicon.md")
    # `<verb>:<scope>_<object>` (knows:any_deck_id, role:reader) OR a bare
    # state token (authenticated, verified) — personas hold the bare form. The
    # check exists to reject free prose ("attacker knows the UUID"), which joins
    # nothing and silently breaks the chain, not to police style.
    for field in ("preconditions", "postconditions"):
        for cap in finding.get(field) or []:
            if not isinstance(cap, str) or not _CAP_GRAMMAR.match(cap):
                errs.append(
                    f"line {lineno}: {field} entry {cap!r} is not in the "
                    "<verb>:<scope>_<object> grammar (lib/capability-lexicon.md)")
    return errs


_HIGH_PLUS = {"CRITICAL", "HIGH"}


def _sev(finding: dict) -> str:
    """Effective severity: computed wins, asserted is the fallback."""
    return str(finding.get("severity_computed")
               or finding.get("severity") or "").upper()


def evidence_class_of(finding: dict) -> str:
    ec = finding.get("evidence_class")
    return ec if isinstance(ec, str) and ec else "agent_judgement"


def evidence_discipline_errors(lineno: int, finding: dict,
                               known_ids: set[str] | None = None) -> list[str]:
    """v2.6: the Wave-3 obligations, enforced mechanically rather than in prose.

    Every one of these was written as methodology guidance first. The audit's own
    headline finding across five themes was `control-versus-prose gaps` — a
    control exists in a comment, a policy table or a design doc and is not
    enforced on the path that matters. An obligation that lives only in a step
    file is that same defect, committed by the tool that exists to detect it.

    Annexed rows (v2.6 Wave 2b) are enumeration legs folded into a parent
    finding, not findings in their own right, so the parent carries the
    obligations and these checks skip them.
    """
    annex = finding.get("annexed_to")
    if annex:
        # An annexed row is exempt because its PARENT carries the obligations.
        # If the parent does not exist, nothing carries them and the row has
        # vanished from the report instead of being demoted — `annexed_to` would
        # be a one-field way to delete a finding. Only `heuristic_inventory` rows
        # are annexable: a judgement finding may never fold itself into another.
        if known_ids is not None and annex not in known_ids:
            return [f"line {lineno}: `annexed_to` points at `{annex}`, which is "
                    "not a finding in this corpus — an annexed row is exempt from "
                    "the HIGH+ obligations because its PARENT carries them, so a "
                    "dangling parent deletes the finding rather than demoting it"]
        if evidence_class_of(finding) != "heuristic_inventory":
            return [f"line {lineno}: only `heuristic_inventory` rows may be "
                    f"annexed; this row is `{evidence_class_of(finding)}`. The "
                    "annex exists to fold MECHANICAL enumeration legs into the "
                    "judgement finding they restate, not to let a judgement "
                    "finding suppress itself"]
        return []
    errs = []

    # --- Sibling sweep (story 3.1). The single highest-value check here.
    # Of 34 defects an eight-engineer triage found and the audit missed, the
    # majority were the second, third and fourth site of a defect the audit
    # correctly found ONCE: 10 postgres() call sites filed as "all four",
    # 25 RLS bypass clauses filed as 1 policy, 7 plain-HTTP downgrades filed
    # as 1. Each of those counts is a one-line grep. A mechanical sweep does
    # not get bored at nine; both the tool and eight engineers did.
    if _sev(finding) in _HIGH_PLUS:
        if "sibling_sites" not in finding:
            errs.append(
                f"line {lineno}: HIGH+ finding requires `sibling_sites` — run the "
                "defect's shape repo-wide and list every other site, or pass [] to "
                "claim the cited site is the only one")
        elif not finding.get("sibling_pattern"):
            # An empty list is a CLAIM ("this is the only site"), and a claim
            # needs the evidence that backs it. Without the pattern, [] is an
            # omission wearing a claim's clothes — which is the exact shape
            # this field exists to prevent.
            errs.append(
                f"line {lineno}: `sibling_sites` present but no `sibling_pattern` — "
                "state the grep/AST pattern actually run repo-wide; an empty list "
                "with no pattern is an omission, not a claim")

    # --- Refutation scoping (story 3.2). The most dangerous class measured.
    # A refutation true of ONE module was generalised to a system property and
    # buried a live HIGH: two call sites handed a signing key to a function that
    # set `Authorization: Bearer`. A false positive costs a triager minutes and
    # self-corrects; a wrong refutation stops them reading the code, and nothing
    # downstream reopens it.
    if finding.get("attacked") == "refuted" and not finding.get("refutation_scope"):
        errs.append(
            f"line {lineno}: `attacked: refuted` requires `refutation_scope` — "
            "name the boundary actually examined (module / file set / call-graph "
            "depth). A refutation may only be scoped to what was read")

    # --- Fix confidence (story 3.3).
    # Six findings on one Postgres-TLS defect: the FINDING was right on all six,
    # the FIX was wrong on five. Fix text is what gets executed, and it currently
    # inherits the finding's confidence for free.
    fc = finding.get("fix_confidence")
    if finding.get("suggested_fix") and not fc:
        errs.append(
            f"line {lineno}: `suggested_fix` present but no `fix_confidence` — "
            "rate the FIX separately from the finding "
            "(verified requires a cited line in the dependency being asserted about)")
    elif fc == "verified" and not _CITE_RE.search(str(finding.get("suggested_fix") or "")):
        # `verified` is the only value that buys anything downstream (§7.4b lets
        # it win a fix-contradiction), so it is the one that must be earned. In
        # the measured case the CORRECT fix of six was the only one citing driver
        # source; an unearned `verified` hands the win to the wrong text.
        errs.append(
            f"line {lineno}: `fix_confidence: verified` requires a cited "
            "`file:line` in `suggested_fix`, naming the dependency/driver/API "
            "the claim is about — otherwise `verified` is self-asserted, which "
            "is exactly how `confidence: CONFIRMED` became a 9.6%-true label")

    # --- Reachability evidence (story 1.4).
    # Fail-open by design: this suppresses an R3 escalation, so an uncited claim
    # must not be able to do it. Otherwise the field becomes the next
    # self-asserted CONFIRMED.
    dr = finding.get("deployment_reachability")
    if isinstance(dr, dict) and dr.get("state") in (
            "structurally_unreachable", "gated_by_runtime_flag"):
        if not dr.get("evidence"):
            errs.append(
                f"line {lineno}: `deployment_reachability.state = "
                f"{dr.get('state')}` requires an `evidence` cite (file:line) — "
                "an uncited unreachability claim does not suppress escalation")

    return errs


def validate_with_jsonschema(schema: dict, findings, cwe_ids: set[str] | None,
                             require_cats: set[str] | None = None,
                             evidence_discipline: bool = False,
                             known_ids: set[str] | None = None):
    import jsonschema  # type: ignore
    validator = jsonschema.Draft202012Validator(schema)
    errors = []
    for lineno, finding in findings:
        if "__parse_error__" in finding:
            errors.append(f"line {lineno}: JSON parse error — {finding['__parse_error__']}")
            continue
        for err in sorted(validator.iter_errors(finding), key=lambda e: e.path):
            path = ".".join(str(p) for p in err.path) or "<root>"
            errors.append(f"line {lineno}: {path}: {err.message}")
        if cwe_ids is not None:
            cwe = finding.get("cwe")
            if cwe and cwe not in cwe_ids:
                errors.append(
                    f"line {lineno}: cwe `{cwe}` not in cwe-map.json "
                    f"(schema pattern allows any CWE-\\d+; semantic check requires map entry)"
                )
        errors.extend(capability_errors(lineno, finding, require_cats or set()))
        if evidence_discipline:
            errors.extend(evidence_discipline_errors(lineno, finding, known_ids))
    return errors


def validate_manual(schema: dict, findings, cwe_ids: set[str] | None,
                    require_cats: set[str] | None = None,
                    evidence_discipline: bool = False,
                    known_ids: set[str] | None = None):
    """Minimal manual validator used when jsonschema is unavailable.
    Checks only the top-level `required` list + CWE-in-map + capability
    requirements when provided. Not a substitute for jsonschema — CI must
    install it."""
    required = schema.get("required", [])
    errors = []
    for lineno, finding in findings:
        if "__parse_error__" in finding:
            errors.append(f"line {lineno}: JSON parse error — {finding['__parse_error__']}")
            continue
        for field in required:
            if field not in finding:
                errors.append(f"line {lineno}: missing required field `{field}`")
        if cwe_ids is not None:
            cwe = finding.get("cwe")
            if cwe and cwe not in cwe_ids:
                errors.append(f"line {lineno}: cwe `{cwe}` not in cwe-map.json")
        errors.extend(capability_errors(lineno, finding, require_cats or set()))
        if evidence_discipline:
            errors.extend(evidence_discipline_errors(lineno, finding, known_ids))
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument(
        "--cwe-map",
        type=Path,
        default=None,
        help="Optional path to cwe-map.json. If provided, every finding's `cwe` must exist in the map (semantic check beyond the schema's regex).",
    )
    parser.add_argument(
        "--require-capabilities",
        default=None,
        help="Comma-separated categories whose findings MUST carry "
             "`preconditions` and a non-empty `postconditions` "
             "(lib/capability-lexicon.md). Phase 5 passes "
             "auth,idor,token_scope,collection_scope. Without capability tags "
             "the Phase-7 attack-path arithmetic has nothing to compose, and "
             "chained findings silently keep their in-isolation severity.",
    )
    parser.add_argument(
        "--require-evidence-discipline",
        action="store_true",
        help="Enforce the v2.6 Wave-3 obligations mechanically instead of in prose: "
             "HIGH+ findings must carry `sibling_sites` + `sibling_pattern`; a "
             "`refuted` verdict must carry `refutation_scope`; a `suggested_fix` "
             "must carry `fix_confidence`; and a non-`reachable` "
             "`deployment_reachability` must cite a line. Each of these was a "
             "measured failure in a calibrated run — see "
             "docs/EPIC-v2.6-calibrated-severity.md.",
    )
    parser.add_argument("jsonl", type=Path, help="Path to a findings JSONL file")
    parser.add_argument("--quiet", action="store_true", help="Only emit non-zero exit; no stderr")
    args = parser.parse_args()

    if not args.schema.exists():
        print(f"ERROR: schema not found: {args.schema}", file=sys.stderr)
        sys.exit(2)
    if not args.jsonl.exists():
        print(f"ERROR: findings file not found: {args.jsonl}", file=sys.stderr)
        sys.exit(2)
    if args.cwe_map is not None and not args.cwe_map.exists():
        print(f"ERROR: cwe-map not found: {args.cwe_map}", file=sys.stderr)
        sys.exit(2)

    schema = load_schema(args.schema)
    findings = list(iter_findings(args.jsonl))
    cwe_ids = load_cwe_map(args.cwe_map)

    require_cats = {c.strip() for c in args.require_capabilities.split(",")
                    if c.strip()} if args.require_capabilities else set()

    # Ids present in THIS file. An `annexed_to` pointing outside it cannot be
    # resolved here, so the check only fires when the target is absent from a
    # corpus that plausibly contains it (see evidence_discipline_errors).
    known_ids = {f.get("id") for _, f in findings if isinstance(f.get("id"), str)}

    try:
        errors = validate_with_jsonschema(schema, findings, cwe_ids, require_cats,
                                          args.require_evidence_discipline,
                                          known_ids)
        backend = "jsonschema"
    except ImportError:
        errors = validate_manual(schema, findings, cwe_ids, require_cats,
                                 args.require_evidence_discipline,
                                 known_ids)
        backend = "manual-fallback"
        if not args.quiet:
            print(
                "WARNING: jsonschema not installed — using minimal manual validator. "
                "CI must `pip install jsonschema` for full coverage.",
                file=sys.stderr,
            )

    if errors:
        if not args.quiet:
            print(f"FAIL ({backend}): {len(errors)} issue(s) in {args.jsonl}", file=sys.stderr)
            for e in errors[:50]:
                print(f"  - {e}", file=sys.stderr)
            if len(errors) > 50:
                print(f"  ... and {len(errors) - 50} more.", file=sys.stderr)
        sys.exit(1)

    if not args.quiet:
        n_findings = sum(1 for _, f in findings if "__parse_error__" not in f)
        print(f"OK ({backend}): {n_findings} findings validated against {args.schema.name}")


if __name__ == "__main__":
    main()
