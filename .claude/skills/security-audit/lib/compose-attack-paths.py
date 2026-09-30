#!/usr/bin/env python3
"""
compose-attack-paths.py — Phase-7 severity gate (v2.6).

WHY THIS EXISTS
---------------
2026-03-15 audit, finding M6, confidence CONFIRMED, filed MEDIUM:

    "...build-output bypasses that if the deck UUID is known.
     Combined with H1, an attacker can identify published decks and
     access output directly."

H1 — "GET /api/decks returns ALL decks (including private) to any authenticated
reader — enables enumeration" — was a **HIGH in the same document**, supplying
exactly the capability M6's mitigation ("if the UUID is known") assumed nobody
had. M6 stayed unremediated for 96 days, was downgraded to LOW at the next
baseline, and the sibling endpoint was affirmatively described as
"well-defended (INFO)". Total exposure >= 103 days.

Chain DETECTION was not the failure. The chain was written down, in prose, by a
human, in the finding's own description. Chain ARITHMETIC was the failure:
severity was assigned by category and instinct, and nothing in the methodology
gave that sentence power over the rating.

So the control is not "detect more chains". It is: **make severity a computed
function of the attack path that prose cannot contradict, and make a silent
downgrade across runs impossible.**

MODEL
-----
Every finding declares (lib/capability-lexicon.md):
  preconditions  — capabilities an attacker must already hold
  postconditions — capabilities the finding grants
Paths start from attacker PERSONAS. A finding joins a path when its
preconditions are satisfied by the persona plus everything already traversed.

RULES (each maps to an observed real-world failure)
  R1 UNDISCHARGED-MITIGATION  A finding whose precondition is supplied by another
     finding's postcondition may not treat that precondition as mitigating.
     Severity floor = the supplying finding's severity. Applied to a fixpoint so
     multi-hop chains propagate.                                        (M6/H1)
  R2 PROSE-REFERENCES-CHAIN   A finding whose text says "combined with X" and
     names another finding must be >= that finding's severity. Five lines of
     regex that ALONE would have escalated M6 in March.
  R3 CROWN-JEWEL-REACHED      Any path from an UNPRIVILEGED persona that reaches
     a crown-jewel capability is CRITICAL — but only for the findings that
     actually CONTRIBUTE to reaching it (backward slice), not every finding that
     happens to be reachable. This is the precision fix over the reference
     implementation, which escalated bystanders too.
     R3 is UNCAPPED and deliberately so: it is a distinct mechanism from §7.4's
     ±1 context-signal nudge, and the founding case (M6 above) only works if a
     MEDIUM can reach CRITICAL in one step. v2.6 gates it on evidence instead:
     a contributing member declared `structurally_unreachable` WITH a cite
     suppresses the escalation, and the suppression is reported loudly.
     (v2.6) Rows carrying `annexed_to` — mechanical enumeration legs folded into
     a judgement finding, Wave 2b — are excluded from the graph entirely, which
     is where 47% of the calibrated run's capability tags came from.
  R4 SEVERITY-RATCHET         Severity may never decrease across runs without a
     recorded reason naming what changed (fix commit / compensating control /
     disproven exploitability / rescope). A downgrade with no reason FAILS the
     run. A finding that DISAPPEARS unexplained is itself a finding.
                              (CONFIRMED-MEDIUM -> LOW -> "well-defended")

LIFECYCLE GATES (R1-R4 fix the rating; these force the action)
  L1 AGE          A CONFIRMED HIGH/CRITICAL older than --max-age-days with no
     linked fix commit and no unexpired acceptance FAILS the run. This is the
     gate that closes the 96-day hole.
  L2 ACCEPTANCE   HIGH+ cannot be closed as `accepted` without a named owner AND
     an expiry date; an expired acceptance is not an acceptance.
  L3 CLOSURE      `verified` requires a regression test id. `fixed` without one
     is reported: in the historical case the fix shipped with no denial test and
     a sibling test mocked the very gate it should have pinned, so "fixed" was
     never mechanically proven — which is why the class recurred on a different
     endpoint.

Usage:
  python3 compose-attack-paths.py <findings.jsonl ...> \
      [--profile phase-00-profile.json] [--baseline baseline.json] \
      [--changed-files changed.txt] [--run-id RID] [--now ISO8601] \
      [--max-age-days 30] [--strict-closure] \
      [--out governance.jsonl] [--rewrite corrected.jsonl] \
      [--json-summary summary.json] [--quiet]
  python3 compose-attack-paths.py --print-contract
      Print the severity contract and exit 0. tests/test-attack-paths.sh diffs
      this against the `severity-contract` block in steps/phase-07-synthesis.md,
      so the prose and the arithmetic agree by assertion rather than by reading.

Exit codes:
  0  clean — no escalation required, no governance failure
  1  escalations required OR a governance gate failed (blocks publication of a
     clean bill; Phase 7 must apply --rewrite and re-run to convergence, and
     Phase 8 must not write a baseline while governance failures stand)
  2  argparse / I/O error
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# v2.6: `lstrip("./")` takes a CHARACTER SET, not a prefix — so `.output/x`
# became `output/x`, `./.env` became `env`, and any path whose first component
# starts with a dot was silently rewritten into a different path. Shipped in
# v2.5; together with the missing ignore-file support it produced 64 phantom
# coverage failures that masked 7 real credential gaps and 129 real collection
# gaps. Fail-closed gates failing in the NOISY direction is the specific way a
# fail-closed gate stops being trusted.
#
# The calibration analysis filed this as one bug in one file. A repo-wide sweep
# for the shape found ten call sites across three modules — the release's own
# §1.6 lesson ("the tool finds instances, not classes") landing on the release
# itself. Here it also corrupted BASELINE MATCH KEYS, so a finding under
# `.github/` or `.output/` could fail to match its own baseline entry, resetting
# `first_seen_at` and blinding the R4 ratchet and the L1 age gate.
_DOT_PREFIX_RE = re.compile(r"^(?:\./)+")


def _strip_dot_prefix(s):
    """Strip leading `./` path prefixes. Never touches a leading dot that is
    part of a real name (`.github/`, `.output/`, `.env`)."""
    return _DOT_PREFIX_RE.sub("", str(s))


SEV = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
SEV_IDX = {s: i for i, s in enumerate(SEV)}


def sidx(s):
    return SEV_IDX.get(str(s).upper(), 0)


def smax(a, b):
    return a if sidx(a) >= sidx(b) else b


# --- Evidence class (v2.6) --------------------------------------------------
#
# `confidence` conflated three orthogonal things: where the row came from,
# whether anyone attacked it, and how sure we are. A calibrated run measured the
# cost — CONFIRMED findings were 9.6% true, unlabelled ones 92.1% — because the
# label only ever recorded WHICH PHASE emitted the row. evidence_class records
# the first of those three explicitly so the other two stop borrowing its
# authority.

#: The only class that earns the §7.4 +1 severity promotion. A heuristic over an
#: inventory a sub-agent WROTE is not a scanner, whatever its output looks like.
PROMOTABLE_EVIDENCE = {"external_scanner"}

#: Excluded from the L1 age gate: too noisy to nag about. Everything else is
#: eligible, which is the v2.6 widening — see the L1 comment below.
_L1_EXCLUDED_EVIDENCE = {"heuristic_inventory"}


#: Substrings identifying THIS SKILL's own reconcilers in `sources[].detail`.
#: Used only to classify a pre-v2.6 row that predates `evidence_class`.
_HEURISTIC_SOURCE_HINTS = ("validate-egress", "validate-collection-scoping")

#: External tools. A `scanner`-kind source naming one of these is the only thing
#: that earns `external_scanner`; `validate-*.py` calling itself a scanner is the
#: category error the whole field exists to prevent.
_EXTERNAL_TOOL_HINTS = ("semgrep", "trivy", "osv-scanner", "gitleaks",
                        "trufflehog", "hadolint", "checkov", "grype")


def evidence_class(f):
    """Read a finding's evidence class, INFERRING it when the field is absent.

    Defaulting straight to `agent_judgement` was fail-safe only for the +1
    promotion. It was fail-OPEN everywhere else: a pre-v2.6 R-rule row carried
    forward from a baseline (which the R4 ratchet explicitly supports across a
    v2.5 -> v2.6 upgrade) would land in the 92.1%-true judgement band, stay
    eligible for the L1 age gate, escape annexation — which keys on
    `heuristic_inventory` exactly — and keep minting capabilities. It would
    inherit the trust of a class it never earned, which is this release's
    founding defect wearing a version-skew hat.

    So when the field is missing, classify from `sources[]` first and only fall
    back to `agent_judgement` when nothing identifies the row.
    """
    ec = (f or {}).get("evidence_class")
    if isinstance(ec, str) and ec:
        return ec
    for src in (f or {}).get("sources") or []:
        detail = str((src or {}).get("detail") or "").lower()
        kind = str((src or {}).get("kind") or "").lower()
        if kind == "heuristic" or any(h in detail for h in _HEURISTIC_SOURCE_HINTS):
            return "heuristic_inventory"
        if kind == "scanner" and any(t in detail for t in _EXTERNAL_TOOL_HINTS):
            return "external_scanner"
    return "agent_judgement"


def _l1_eligible(f):
    return evidence_class(f) not in _L1_EXCLUDED_EVIDENCE


# --- R3 escalation contract (v2.6, story 1.4) -------------------------------
#
# The prose in steps/phase-07-synthesis.md §7.4 caps context-signal adjustment
# at ±1 rung "regardless of how many triggers fire". v2.5 shipped that sentence
# next to a composer that sets CRITICAL outright, and a reader calibrating on
# §7.4 therefore mis-read every composed severity.
#
# THE CODE IS RIGHT AND THE PROSE WAS WRONG. These are two mechanisms:
#
#   §7.4  context signals (trust_zone, data_ops, evidence_class) — a calibration
#         nudge over ONE finding read in isolation. Capped at ±1, because the
#         severity was already set by the rubric and context only corroborates.
#   R3    chain composition — a claim about a PATH, not a nudge. The founding
#         case was a MEDIUM whose mitigation ("only if the UUID is known") was
#         discharged by a HIGH in the same document. Cap R3 at one rung and that
#         finding becomes HIGH, which is exactly the rating that let it rot for
#         96 days. Capping the composer kills the thesis.
#
# So R3 stays uncapped and is gated on EVIDENCE instead. The measured defect it
# has to answer for: a dev-mode finding asserted LOW and computed CRITICAL on a
# genuine chain, whose `isDemoCapableEnv` allowlists only {local, sandbox} with
# a fail-closed `unknown` default — structurally unreachable in dev, staging and
# production. The analyst who rated it LOW already knew that. The information
# existed and had no channel to reach the composer. `deployment_reachability` is
# that channel.
#
# These constants ARE the contract: `--print-contract` prints them, and
# tests/test-attack-paths.sh diffs that output against the fenced
# `severity-contract` block in steps/phase-07-synthesis.md. Prose and behaviour
# agree because a test says so, not because someone read both.

#: R3's target. Not a rung offset — a claim that the path is fully exploitable.
R3_ESCALATION_TARGET = "CRITICAL"

#: R3 is NOT subject to §7.4's ±1 cap. See the block comment above.
R3_ESCALATION_CAPPED = False

#: §7.4's cap, restated here only so the contract carries it. The composer does
#: not implement §7.4 (that is the orchestrator's job in phase-07), so this key
#: is a declared constant rather than an observed behaviour — the test asserts
#: prose/contract agreement for it, and asserts R3's uncapped behaviour against
#: fixtures separately.
CONTEXT_SIGNAL_CAP_RUNGS = 1

#: Every value `deployment_reachability.state` may take (lib/finding-schema.json).
_REACHABILITY_STATES = ("reachable", "gated_by_runtime_flag",
                        "structurally_unreachable")

#: The ONLY state that can suppress an R3 escalation, and only with a cite.
#:
#: `gated_by_runtime_flag` deliberately does NOT suppress: a flag an admin can
#: toggle in a deployed environment is live, not theoretical. That discriminator
#: is the one the calibration triage itself drew — "App mode is toggled at
#: runtime by admins, so this is live". Only a build-time or deploy-time
#: structural constraint counts.
_SUPPRESSING_REACHABILITY = "structurally_unreachable"
_NONSUPPRESSING_REACHABILITY = tuple(s for s in _REACHABILITY_STATES
                                     if s != _SUPPRESSING_REACHABILITY)

#: Wave 2b.3 — annexed rows leave the capability graph entirely.
ANNEXED_ROWS_IN_GRAPH = False


def contract_lines():
    """The machine-checked severity contract, as `key = value` text.

    Kept in `key = value` form rather than JSON so the fenced block in
    steps/phase-07-synthesis.md can be diffed against it byte-for-byte.
    """
    def b(v):
        return "true" if v else "false"
    return [
        f"context_signal_cap_rungs = {CONTEXT_SIGNAL_CAP_RUNGS}",
        f"promotable_evidence = {','.join(sorted(PROMOTABLE_EVIDENCE))}",
        f"r3_escalation_target = {R3_ESCALATION_TARGET}",
        f"r3_escalation_capped = {b(R3_ESCALATION_CAPPED)}",
        f"r3_suppressing_state = {_SUPPRESSING_REACHABILITY}",
        "r3_suppression_requires_cite = true",
        f"r3_nonsuppressing_states = {','.join(_NONSUPPRESSING_REACHABILITY)}",
        f"annexed_rows_in_graph = {b(ANNEXED_ROWS_IN_GRAPH)}",
    ]


def reachability(f):
    """-> (state, cite). Absent / malformed reads as `reachable`, with no cite.

    Fail-open toward escalation: missing a reachable chain is unrecoverable,
    escalating an unreachable one costs triage time. So a row that says nothing
    escalates normally, and only a positive, cited claim stops it.
    """
    dr = (f or {}).get("deployment_reachability")
    if not isinstance(dr, dict):
        return "reachable", None
    state = dr.get("state")
    if not isinstance(state, str) or not state:
        return "reachable", None
    ev = dr.get("evidence")
    ev = ev.strip() if isinstance(ev, str) else ""
    return state, (ev or None)


def suppression_evidence(f):
    """-> the cite that suppresses R3 for this finding, else None.

    Requires BOTH `structurally_unreachable` and a non-empty cite. Without the
    cite requirement `deployment_reachability` becomes the next self-asserted
    CONFIRMED: a label anyone can set that silently buys a severity concession,
    with nothing downstream able to check it. v2.5 shipped exactly that shape —
    `validate-egress.py` hardcoded `"confidence": "CONFIRMED"` at emission,
    before anything was attacked, and bought a rung with it.
    """
    state, cite = reachability(f)
    return cite if (state == _SUPPRESSING_REACHABILITY and cite) else None


def uncited_unreachable(f):
    """A `structurally_unreachable` claim with no cite — ignored, but loudly."""
    state, cite = reachability(f)
    return state == _SUPPRESSING_REACHABILITY and not cite


def annexed_to(f):
    """The parent finding id when this row is a Wave-2b annex leg, else None."""
    v = (f or {}).get("annexed_to")
    return v.strip() if isinstance(v, str) and v.strip() else None


def in_capability_graph(f):
    """Wave 2b.3 — an annexed row is a LEG of another finding, not a finding.

    It contributes no severity of its own, so it must not mint capabilities
    either: 47% of the calibrated run's 1120 capability tags were minted by the
    C-rules with no evidence check, and 53 of 73 HIGH+ C-rule findings ended
    CRITICAL while 72 of 73 were false. Excluding annexed rows removes that
    escalation path at its source rather than by threshold tuning.
    """
    return ANNEXED_ROWS_IN_GRAPH or annexed_to(f) is None


# --- Capability normalisation ----------------------------------------------
# One vocabulary or the chain silently breaks. See lib/capability-lexicon.md.
_VERB_SYNONYMS = {
    "read": "reads", "reading": "reads", "view": "reads", "views": "reads",
    "list": "knows", "lists": "knows", "enumerate": "knows",
    "enumerates": "knows", "discover": "knows", "discovers": "knows",
    "know": "knows", "identify": "knows", "identifies": "knows",
    "write": "writes", "modify": "writes", "modifies": "writes",
    "update": "writes", "updates": "writes", "create": "writes",
    "delete": "deletes", "destroy": "deletes", "remove": "deletes",
    "exec": "executes", "execute": "executes", "rce": "executes",
    "escalate": "escalates", "privesc": "escalates", "elevate": "escalates",
    "impersonate": "impersonates", "bypass": "bypasses",
    "authenticate": "authenticates", "auth": "authenticates",
    # v2.6 (story 4.4): availability / integrity verbs. The calibrated run
    # missed a HIGH whose entire attack path had no confidentiality component —
    # an uncapped provisioning call mints enough rows to displace every real one
    # from a downstream fixed-size scan, producing an estate-wide silent
    # attribution stop. `normcap` passes unknown verbs through and `satisfies`
    # is exact-match, so such a capability composes fine once written in
    # canonical form — but WITHOUT these entries the synonyms silently fail to
    # normalise and the chain breaks at the join. A capability that joins
    # nothing is invisible to R1/R3, which is the failure mode this table exists
    # to prevent.
    "deny": "denies", "starve": "denies", "starves": "denies",
    "exhaust": "denies", "exhausts": "denies", "dos": "denies",
    "corrupt": "corrupts", "truncate": "corrupts", "truncates": "corrupts",
    "falsify": "corrupts", "falsifies": "corrupts", "poison": "corrupts",
    "poisons": "corrupts",
}
_SCOPES = ("any", "own", "other", "cross_tenant", "self")


def normcap(s):
    """`Reads: Any-Deck Content` -> `reads:any_deck_content`."""
    if not s:
        return ""
    t = str(s).strip().lower().replace("-", "_")
    t = re.sub(r"\s+", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    if ":" in t:
        verb, _, rest = t.partition(":")
        verb = verb.strip("_")
        verb = _VERB_SYNONYMS.get(verb, verb)
        return f"{verb}:{rest.strip('_')}"
    return t


def split_cap(c):
    """-> (verb, scope, object). scope is '' when not one of the closed set."""
    verb, _, rest = normcap(c).partition(":")
    if not rest:
        return verb, "", ""
    for sc in sorted(_SCOPES, key=len, reverse=True):
        if rest == sc:
            return verb, sc, ""
        if rest.startswith(sc + "_"):
            return verb, sc, rest[len(sc) + 1:]
    return verb, "", rest


def satisfies(post, need):
    """Does postcondition `post` satisfy requirement `need`?

    Exact match, or the documented containment rule: a capability at scope `any`
    subsumes the same verb+object at any narrower scope. No other implication."""
    p, n = normcap(post), normcap(need)
    if not p or not n:
        return False
    if p == n:
        return True
    pv, ps, po = split_cap(p)
    nv, ns, no = split_cap(n)
    return bool(pv and pv == nv and po and po == no and ps == "any" and ns != "any")


def satisfied_by(need, held):
    return any(satisfies(h, need) for h in held)


# --- Personas / crown jewels ------------------------------------------------
_DEFAULT_PERSONAS = {
    "anonymous": [],
    "authenticated_user": ["authenticated"],
}
_DEFAULT_UNPRIVILEGED = ["anonymous"]
# Fallback crown-jewel PATTERNS, used in addition to any explicit list. These
# make R3 work even when Phase 0 failed to derive a lexicon — defence in depth
# against the gate being silently inert.
_JEWEL_PATTERNS = [
    re.compile(r"^reads:any_.*_(pii|content|secret|token|credential)$"),
    re.compile(r"^reads:(any_user_pii|cross_tenant_.*)$"),
    re.compile(r"^writes:any_.*$"),
    re.compile(r"^deletes:any_.*$"),
    re.compile(r"^escalates:.*$"),
    re.compile(r"^impersonates:.*$"),
    re.compile(r"^executes:.*$"),
]


def resolve_lexicon(profile):
    lex = ((profile or {}).get("capability_lexicon") or {})
    personas = {k: [normcap(c) for c in v]
                for k, v in (lex.get("personas") or _DEFAULT_PERSONAS).items()}
    unpriv = set(lex.get("unprivileged") or _DEFAULT_UNPRIVILEGED)
    jewels = {normcap(j) for j in (lex.get("crown_jewels") or [])}
    derived = False
    if not jewels:
        derived = True
    return personas, unpriv, jewels, derived


def is_jewel(cap, jewels):
    c = normcap(cap)
    if c in jewels:
        return True
    return any(p.match(c) for p in _JEWEL_PATTERNS)


# --- Loading ----------------------------------------------------------------
def load_findings(paths, quiet=False):
    out = []
    for p in paths:
        p = Path(p)
        if not p.exists() or p.is_dir():
            continue
        try:
            raw = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for ln, line in enumerate(raw.splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                f = json.loads(line)
            except json.JSONDecodeError:
                if not quiet:
                    print(f"  ! unparseable {p}:{ln}", file=sys.stderr)
                continue
            if not isinstance(f, dict) or "severity" not in f:
                continue
            f.setdefault("preconditions", [])
            f.setdefault("postconditions", [])
            f["_src"] = str(p)
            out.append(f)
    return out


def fingerprint_of(f):
    fp = f.get("fingerprint")
    if fp:
        return fp
    key = f"{f.get('file','')}:{f.get('line','')}:{f.get('cwe','')}:{f.get('category','')}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


# --- R1 + R3: capability composition ----------------------------------------
def compose(findings, held0):
    """Greedy fixpoint over indices. Returns (path_indices, held_capabilities)."""
    held = set(normcap(c) for c in held0)
    path, in_path = [], set()
    changed = True
    while changed:
        changed = False
        for i, f in enumerate(findings):
            if i in in_path:
                continue
            if all(satisfied_by(pc, held) for pc in f["preconditions"]):
                path.append(i)
                in_path.add(i)
                held |= {normcap(c) for c in f["postconditions"]}
                changed = True
    return path, held


def contributing_slice(findings, path, held0, jewels_reached):
    """Backward slice: which findings actually get the attacker to a jewel?

    The reference implementation escalated EVERY reachable finding to chain
    severity, which over-escalates bystanders. A finding contributes when one of
    its postconditions satisfies something still needed — starting from the
    jewels and walking back through unmet preconditions."""
    held = {normcap(c) for c in held0}
    need = set(jewels_reached)
    contrib = set()
    changed = True
    while changed:
        changed = False
        for i in path:
            if i in contrib:
                continue
            f = findings[i]
            if any(satisfies(pc, n) for pc in f["postconditions"] for n in need):
                contrib.add(i)
                for pre in f["preconditions"]:
                    if not satisfied_by(pre, held):
                        need.add(normcap(pre))
                changed = True
    return contrib


# --- R2: prose that names another finding -----------------------------------
_CHAIN_PROSE = re.compile(
    r"combined with|combined,|chained with|chained to|chained|together with|"
    r"in combination|in conjunction|coupled with|paired with|when combined|"
    r"alongside|leverag\w+ (?:the )?(?:above|prior|other)", re.IGNORECASE)
_ID_TOKEN = re.compile(r"\b([A-Z][A-Z0-9]*(?:[-_:][A-Za-z0-9]+)*-?\d+)\b")

_PROSE_FIELDS = ("title", "description", "attack_scenario", "notes",
                 "exploit", "evidence", "summary", "suggested_fix")


def alias_map(findings):
    """id / display_id / declared aliases -> finding index. Case-folded."""
    amap = {}
    for i, f in enumerate(findings):
        # Wave 2b: an annexed row carries no severity of its own, so it can
        # neither be raised by prose nor lend its rating to something else.
        if not in_capability_graph(f):
            continue
        keys = [f.get("id"), f.get("display_id")]
        keys += list(f.get("aliases") or [])
        fid = str(f.get("id") or "")
        tail = fid.rsplit(":", 1)[-1]
        if tail and not tail.isdigit():
            keys.append(tail)
        for k in keys:
            if k:
                amap.setdefault(str(k).upper(), i)
    return amap


def prose_escalations(findings):
    amap = alias_map(findings)
    hits = []
    for i, f in enumerate(findings):
        if not in_capability_graph(f):
            continue
        blob = " ".join(str(f.get(k, "")) for k in _PROSE_FIELDS)
        if not blob.strip() or not _CHAIN_PROSE.search(blob):
            continue
        self_keys = {str(f.get("id", "")).upper(), str(f.get("display_id", "")).upper()}
        for tok in set(_ID_TOKEN.findall(blob)):
            j = amap.get(tok.upper())
            if j is None or j == i or tok.upper() in self_keys:
                continue
            other = findings[j]
            if sidx(other.get("severity")) > sidx(f.get("severity")):
                hits.append((i, other.get("severity"),
                             f"prose chains to {other.get('id')} "
                             f"({other.get('severity')})"))
    return hits


# --- R4 + lifecycle ---------------------------------------------------------
_ALLOWED_DOWNGRADE_KINDS = {"fix_commit", "compensating_control",
                            "disproven_exploitability", "rescoped"}


# A finding's fingerprint is sha1(file:line:cwe:category), so adding an import
# above the handler changes it. That silently un-matches the finding from its
# baseline entry: R4 never fires (nothing to compare), first_seen_at resets, and
# L1's age gate restarts from zero — the ratchet goes blind on the most ordinary
# edit there is. Rather than change the fingerprint formula (which would
# invalidate every existing baseline), match exactly first, then fall back to the
# same (file, cwe, category) within a line window.
_FP_LINE_TOLERANCE = 25
# Padding applied to an explicit --changed-files range. Deliberately tiny and
# SEPARATE from _FP_LINE_TOLERANCE: reusing 25 meant a 10-line hunk "explained"
# any finding within 25 lines of it, which is barely tighter than a bare path
# while being marketed as the precise option.
_RANGE_TOLERANCE = 2


def baseline_index(baseline):
    """-> (exact fingerprint index, drift index keyed on (file, cwe, category))."""
    idx, drift = {}, {}
    for b in (baseline or {}).get("findings_carryover", []) or []:
        fp = b.get("fingerprint") or fingerprint_of(b)
        idx[fp] = b
        # Keyed on (file, cwe) only. `category` is NOT required by
        # baseline-schema's findings_carryover, and a pruned v2.4-era baseline
        # omits it — keying on it would make the drift fallback silently never
        # match, which is how this fix failed its own first test.
        key = (_strip_dot_prefix(b.get("file", "")), b.get("cwe"))
        drift.setdefault(key, []).append((b.get("line"), fp, b))
    return idx, drift


_TITLE_SIM_FLOOR = 0.34


def _title_sim(a, b):
    """Jaccard overlap of title tokens. Cheap, and enough to tell two DIFFERENT
    findings apart from the same finding that moved."""
    ta = {t for t in re.split(r"[^a-z0-9]+", str(a or "").lower()) if len(t) > 2}
    tb = {t for t in re.split(r"[^a-z0-9]+", str(b or "").lower()) if len(t) > 2}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def match_baseline(f, bidx, drift, consumed=None):
    """-> (entry, fingerprint_matched, matched_by). matched_by is 'exact',
    'line-drift', or None.

    The drift fallback needs two guards or it trades one silent failure for
    another. A routes file routinely holds several same-CWE unscoped-collection
    findings within 50 lines of each other — exactly this release's own primary
    output shape. Without a similarity floor, a genuinely-FIXED baseline HIGH
    could be 'matched' by an unrelated neighbour, absorbing its fingerprint and
    suppressing the disappearance sweep. Without `consumed`, two current findings
    could both claim the same baseline entry."""
    consumed = consumed if consumed is not None else set()
    fp = fingerprint_of(f)
    if fp in bidx:
        return bidx[fp], fp, "exact"
    key = (_strip_dot_prefix(f.get("file", "")), f.get("cwe"))
    best, best_fp, best_d = None, None, None
    for bline, bfp, b in drift.get(key, []):
        if bfp in consumed:
            continue
        if bline is None or f.get("line") is None:
            continue
        # Compare categories only when BOTH sides declare one.
        bcat, fcat = b.get("category"), f.get("category")
        if bcat and fcat and bcat != fcat:
            continue
        if _title_sim(f.get("title"), b.get("title")) < _TITLE_SIM_FLOOR:
            continue
        d = abs(int(bline) - int(f["line"]))
        if d <= _FP_LINE_TOLERANCE and (best_d is None or d < best_d):
            best, best_fp, best_d = b, bfp, d
    if best is not None:
        consumed.add(best_fp)
        return best, best_fp, "line-drift"
    return None, fp, None


def _parse_changed(entries):
    """`--changed-files` accepts `path` or `path:start-end`. Ranges let a
    disappearance be explained by a change to the finding's OWN lines; a bare
    path only says the file was touched somewhere."""
    files, ranges = set(), {}
    for raw in entries or []:
        raw = _strip_dot_prefix(str(raw).strip())
        if not raw:
            continue
        m = re.match(r"^(.*?):(\d+)-(\d+)$", raw)
        if m:
            files.add(m.group(1))
            ranges.setdefault(m.group(1), []).append((int(m.group(2)), int(m.group(3))))
        else:
            files.add(raw)
    return files, ranges


def governance_checks(findings, baseline, changed_files, now, run_id,
                      max_age_days, strict_closure):
    """R4 + L1-L3. Returns (governance_findings, blocking_count)."""
    gov, blocking = [], 0
    bidx, bdrift = baseline_index(baseline)
    bcreated = parse_ts((baseline or {}).get("created_at"))
    changed, changed_ranges = _parse_changed(changed_files)
    seq = 0

    def _gov(rule, severity, title, description, file, line, **extra):
        nonlocal seq
        seq += 1
        g = {
            "id": f"governance:methodology:{seq:04d}",
            "severity": severity,
            "confidence": "CONFIRMED",
            # v2.6: governance rows assert facts about the audit's own artifacts,
            # not about the target. They are deterministic, but they are NOT an
            # external scanner and must not earn the §7.4 +1 promotion.
            "evidence_class": "governance",
            "rule_family": f"governance:{rule}",
            "category": "methodology",
            "partition": "global",
            "file": file or "docs/security-audit-output/security-audit-report.md",
            "line": max(1, int(line or 1)),
            "cwe": "CWE-1007",
            "owasp_ids": ["ASVS-V1.1.1"],
            "title": title[:120],
            "description": description[:800],
            "sources": [{"kind": "scanner",
                         "detail": f"compose-attack-paths.py:{rule}"}],
            "preconditions": [],
            "postconditions": [],
        }
        g.update(extra)
        gov.append(g)
        return g

    # Two-pass drift assignment. Pass 1 scores every (finding, candidate) pair
    # and assigns greedily by quality (title similarity desc, then line distance
    # asc). First-come-first-served by findings order let a weaker match consume
    # the entry that a near-exact match needed, and a finding with no `base` is
    # silently exempt from R4.
    seen_fps, consumed = set(), set()
    drift_assign, taken = {}, set()
    cands = []
    for fi, f in enumerate(findings):
        if fingerprint_of(f) in bidx:
            continue
        key = (_strip_dot_prefix(f.get("file", "")), f.get("cwe"))
        for bline, bfp, b in bdrift.get(key, []):
            if bline is None or f.get("line") is None:
                continue
            bcat, fcat = b.get("category"), f.get("category")
            if bcat and fcat and bcat != fcat:
                continue
            sim = _title_sim(f.get("title"), b.get("title"))
            if sim < _TITLE_SIM_FLOOR:
                continue
            d = abs(int(bline) - int(f["line"]))
            if d <= _FP_LINE_TOLERANCE:
                cands.append((-sim, d, fi, bfp, b))
    for _nsim, _d, fi, bfp, b in sorted(cands, key=lambda c: (c[0], c[1], c[2])):
        if fi in drift_assign or bfp in taken:
            continue
        drift_assign[fi] = (b, bfp)
        taken.add(bfp)

    for fi, f in enumerate(findings):
        fp0 = fingerprint_of(f)
        if fp0 in bidx:
            base, fp, matched_by = bidx[fp0], fp0, "exact"
        elif fi in drift_assign:
            base, bfp = drift_assign[fi]
            fp, matched_by = bfp, "line-drift"
            consumed.add(bfp)
        else:
            base, fp, matched_by = None, fp0, None
        # Record the BASELINE's fingerprint when matched by drift, so the
        # disappearance sweep below does not also report this finding as vanished.
        seen_fps.add(fp)
        seen_fps.add(fingerprint_of(f))
        sev = f.get("severity", "INFO")
        lc = f.get("lifecycle") or {}
        hist = f.get("severity_history") or []

        # --- R4: no silent downgrade.
        if base and sidx(sev) < sidx(base.get("severity", "INFO")):
            new_entries = [h for h in hist
                           if h.get("run_id") == run_id or h.get("run_id") not in
                           {x.get("run_id") for x in (base.get("severity_history") or [])}]
            # The justification must be FOR THIS SEVERITY. Without the
            # `h["severity"] == sev` clause, a single reason recorded once would
            # license every later downgrade of the same finding — MEDIUM -> LOW
            # justified in March would silently cover LOW -> INFO in July, which
            # is precisely the ladder the historical finding walked down.
            justified = any(
                (h.get("reason") or "").strip()
                and h.get("reason_kind") in _ALLOWED_DOWNGRADE_KINDS
                and str(h.get("severity", "")).upper() == str(sev).upper()
                and (h.get("reason_kind") != "fix_commit" or h.get("fix_commit"))
                for h in new_entries)
            if not justified:
                blocking += 1
                _gov("R4", base.get("severity", "HIGH"),
                     f"Unjustified severity downgrade: {f.get('id')} "
                     f"{base.get('severity')} -> {sev}",
                     f"Finding `{f.get('id')}` ({fp}) was {base.get('severity')} in "
                     f"the baseline and is {sev} in this run with no "
                     "`severity_history` entry recording what changed. A downgrade "
                     "requires reason_kind in "
                     f"{sorted(_ALLOWED_DOWNGRADE_KINDS)} plus a reason; a "
                     "`fix_commit` kind also requires the commit sha. This is the "
                     "exact mechanism by which a CONFIRMED MEDIUM became LOW and "
                     "then 'well-defended (INFO)' while remaining exploitable.",
                     f.get("file"), f.get("line"),
                     remediation_effort="trivial")

        # --- L1: age gate. The 96-day hole.
        #
        # v2.6: keyed on evidence_class, NOT on confidence. v2.5 required
        # `confidence == "CONFIRMED"`, and a calibrated run showed CONFIRMED was
        # 9.6% true while unlabelled (agent_judgement) findings were 92.1% true —
        # because only phase-06 ever set the label. So the gate that exists to
        # stop a real finding rotting for 96 days fired on the least reliable
        # population and skipped the most reliable one. Excluding only
        # heuristic_inventory keeps the gate off the noisy mechanical families
        # while pointing it at the findings it was written for.
        if sidx(sev) >= SEV_IDX["HIGH"] and _l1_eligible(f):
            first_seen = (parse_ts(f.get("first_seen_at"))
                          or parse_ts((base or {}).get("first_seen_at"))
                          or (bcreated if base else None))
            if first_seen and now:
                age = (now - first_seen).days
                accepted_ok = (lc.get("state") == "accepted"
                               and lc.get("owner")
                               and (parse_ts(lc.get("expiry")) or now) > now)
                if age > max_age_days and not lc.get("fix_commit") and not accepted_ok:
                    blocking += 1
                    _gov("L1", sev,
                         f"{sev} finding open {age}d with no fix and no valid acceptance",
                         f"`{f.get('id')}` has been CONFIRMED {sev} since "
                         f"{first_seen.date()} ({age} days, threshold "
                         f"{max_age_days}) with no `lifecycle.fix_commit` and no "
                         "unexpired `accepted` record naming an owner. Detection "
                         "was never the bottleneck in the incident this gate exists "
                         "for — the finding was surfaced twice, correctly, and lost "
                         "in triage. Either fix it, or accept it explicitly with an "
                         "owner and an expiry date.",
                         f.get("file"), f.get("line"),
                         remediation_effort="small")

        # --- L2: acceptance must name an owner and an expiry.
        if sidx(sev) >= SEV_IDX["HIGH"] and lc.get("state") == "accepted":
            missing = [k for k in ("owner", "expiry") if not lc.get(k)]
            expired = (parse_ts(lc.get("expiry")) is not None
                       and now is not None
                       and parse_ts(lc.get("expiry")) <= now)
            if missing or expired:
                blocking += 1
                _gov("L2", sev,
                     f"Invalid risk acceptance on {sev} finding {f.get('id')}",
                     f"`{f.get('id')}` is marked accepted but "
                     + (f"is missing {missing}. " if missing else "")
                     + ("the acceptance expired on "
                        f"{lc.get('expiry')}. " if expired else "")
                     + "A HIGH+ finding cannot be closed as accepted without a "
                       "named owner and a live expiry date.",
                     f.get("file"), f.get("line"), remediation_effort="trivial")

        # --- L3: closure requires a regression test.
        if lc.get("state") == "verified" and not lc.get("verified_by_test"):
            blocking += 1
            _gov("L3", "MEDIUM",
                 f"Finding {f.get('id')} marked verified with no regression test",
                 f"`{f.get('id')}` claims lifecycle state `verified` but records no "
                 "`verified_by_test`. Verification means a test that FAILS against "
                 "the vulnerable code. In the incident this gate exists for, the "
                 "fix shipped with no status-code-asserting denial test and a "
                 "sibling test mocked the very gate it should have pinned — so "
                 "'fixed' was never mechanically proven and the class recurred on a "
                 "different endpoint.",
                 f.get("file"), f.get("line"), remediation_effort="small")
        elif lc.get("state") == "fixed" and not lc.get("verified_by_test"):
            if strict_closure:
                blocking += 1
            _gov("L3", "MEDIUM",
                 f"Finding {f.get('id')} marked fixed with no regression test",
                 f"`{f.get('id')}` is marked fixed (commit "
                 f"{lc.get('fix_commit') or 'unrecorded'}) but no regression test is "
                 "linked. Without a test that fails against the vulnerable code, "
                 "the fix is unproven and the class can recur on a sibling handler.",
                 f.get("file"), f.get("line"), remediation_effort="small")

    # --- R4 corollary: a finding that disappears must be explained.
    for fp, b in bidx.items():
        if fp in seen_fps or sidx(b.get("severity", "INFO")) < SEV_IDX["HIGH"]:
            continue
        bfile = _strip_dot_prefix(b.get("file", ""))
        rngs = changed_ranges.get(bfile)
        if bfile and bfile in changed:
            if rngs is None:
                # File-granular evidence only. Accept it (the change may well be
                # the fix) but say so: "some line in this file moved" is not
                # proof that THIS finding was addressed, and treating it as proof
                # is how a vanished HIGH slips through.
                _gov("R4", "INFO",
                     f"Disappearance explained only at file granularity: "
                     f"{str(b.get('title', fp))[:60]}",
                     f"Baseline finding `{fp}` ({b.get('severity')}) is absent "
                     f"from this run. `{bfile}` appears in --changed-files, but "
                     "with no line range, so the change may be unrelated to the "
                     "finding's own lines. Pass ranges "
                     "(`path:start-end`, e.g. from "
                     "`git diff --unified=0`) to make this check precise.",
                     bfile or None, b.get("line"), remediation_effort="trivial")
                continue
            bline = b.get("line")
            if bline is None:
                continue
            exact = any(lo <= int(bline) <= hi for lo, hi in rngs)
            padded = any(lo - _RANGE_TOLERANCE <= int(bline) <= hi + _RANGE_TOLERANCE
                         for lo, hi in rngs)
            if exact:
                continue
            if padded:
                _gov("R4", "INFO",
                     f"Disappearance matched only within +/-{_RANGE_TOLERANCE} "
                     f"lines: {str(b.get('title', fp))[:50]}",
                     f"Baseline finding `{fp}` ({b.get('severity')}) is absent "
                     f"from this run. The changed range in `{bfile}` does not "
                     f"contain line {bline}; it is within "
                     f"{_RANGE_TOLERANCE} lines. Accepted, but flagged so the "
                     "match is not mistaken for exact containment.",
                     bfile or None, bline, remediation_effort="trivial")
                continue
            # The file changed, but not anywhere near this finding's lines.
        blocking += 1
        _gov("R4", b.get("severity", "HIGH"),
             f"disappeared_unexplained: {b.get('title', fp)[:70]}",
             f"Baseline finding `{b.get('fingerprint', fp)}` "
             f"({b.get('severity')}, {bfile or 'unknown file'}) is absent from this "
             "run and no change to its file was recorded. A HIGH+ finding may "
             "vanish because it was fixed, because the scope moved, or because "
             "this run simply failed to look — and those are not the same thing. "
             "Link a code change, or treat this as a coverage regression.",
             bfile or None, b.get("line"), remediation_effort="small")

    return gov, blocking


# --- Main -------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("findings", nargs="*", type=Path,
                    help="Findings JSONL file(s) — e.g. phase-05-*.jsonl phase-06-*.jsonl")
    ap.add_argument("--print-contract", action="store_true",
                    help="Print the severity contract (key = value) and exit. "
                         "tests/test-attack-paths.sh diffs this against the "
                         "`severity-contract` block in phase-07-synthesis.md so "
                         "prose and behaviour agree by assertion, not by reading.")
    ap.add_argument("--profile", type=Path,
                    help="phase-00-profile.json — supplies capability_lexicon "
                         "(personas / unprivileged / crown_jewels).")
    ap.add_argument("--baseline", type=Path,
                    help="Prior .claude-audit/baseline.json — enables R4 + lifecycle.")
    ap.add_argument("--changed-files", type=Path,
                    help="Newline-delimited files changed since the baseline; "
                         "explains a disappeared finding.")
    ap.add_argument("--run-id", default="current")
    ap.add_argument("--now", help="ISO-8601 override for deterministic tests.")
    ap.add_argument("--max-age-days", type=int, default=30)
    ap.add_argument("--strict-closure", action="store_true",
                    help="Treat `fixed` without a regression test as blocking.")
    ap.add_argument("--out", type=Path, help="Write governance findings JSONL here.")
    ap.add_argument("--rewrite", type=Path,
                    help="Write the input findings back with severity_computed / "
                         "severity_history / escalation_rules applied.")
    ap.add_argument("--json-summary", type=Path)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    if args.print_contract:
        print("\n".join(contract_lines()))
        return 0
    if not args.findings:
        ap.error("at least one findings file is required")

    now = parse_ts(args.now) or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    findings = load_findings(args.findings, args.quiet)
    if not findings:
        print("ERROR: no parseable findings in the supplied paths.", file=sys.stderr)
        return 2

    profile = None
    if args.profile and args.profile.exists():
        try:
            profile = json.loads(args.profile.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR: cannot read profile: {e}", file=sys.stderr)
            return 2
    baseline = None
    if args.baseline and args.baseline.exists():
        try:
            baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR: cannot read baseline: {e}", file=sys.stderr)
            return 2
    changed = []
    if args.changed_files and args.changed_files.exists():
        changed = [l.strip() for l in
                   args.changed_files.read_text(encoding="utf-8").splitlines()
                   if l.strip()]

    personas, unpriv, jewels, jewels_derived = resolve_lexicon(profile)
    # Wave 2b.3: annexed rows are enumeration legs of another finding, not
    # findings. They leave the graph here, before a single capability is read.
    annexed = [f for f in findings if not in_capability_graph(f)]
    tagged = [f for f in findings
              if in_capability_graph(f)
              and (f["preconditions"] or f["postconditions"])]

    if not args.quiet:
        print(f"loaded {len(findings)} finding(s); {len(tagged)} carry capability tags")
        if annexed:
            print(f"  {len(annexed)} annexed row(s) excluded from the capability "
                  "graph (Wave 2b.3 — they are legs of a judgement finding)")
        if jewels_derived:
            print("  note: no crown_jewels in profile.capability_lexicon — using "
                  "built-in patterns (Phase 0 §0.14 should derive these)")
        print()

    # target severity per finding index, seeded with the asserted severity
    target = {i: f.get("severity", "INFO") for i, f in enumerate(findings)}
    rules_fired = {i: set() for i in range(len(findings))}
    idx_of = {id(f): i for i, f in enumerate(findings)}

    # --- R2 (prose) ---------------------------------------------------------
    for i, sev, why in prose_escalations(findings):
        if sidx(sev) > sidx(target[i]):
            target[i] = sev
            rules_fired[i].add("R2")
            if not args.quiet:
                print(f"[R2] {findings[i].get('id')}: "
                      f"{findings[i].get('severity')} -> {sev}  ({why})")

    # --- R1 (undischarged mitigation), to a fixpoint ------------------------
    supply = []   # (supplier_idx, consumer_idx, capability)
    for j, consumer in enumerate(findings):
        if not in_capability_graph(consumer):
            continue
        for pre in consumer["preconditions"]:
            for i, supplier in enumerate(findings):
                if i == j or not in_capability_graph(supplier):
                    continue
                if any(satisfies(post, pre) for post in supplier["postconditions"]):
                    supply.append((i, j, normcap(pre)))
    changed_r1 = True
    while changed_r1:
        changed_r1 = False
        for i, j, cap in supply:
            if sidx(target[i]) > sidx(target[j]):
                target[j] = target[i]
                rules_fired[j].add("R1")
                changed_r1 = True
    if supply and not args.quiet:
        print(f"[R1] {len(supply)} undischarged-mitigation link(s): a declared "
              "precondition is supplied by another finding in this same report")

    # --- R3 (crown jewel from an unprivileged persona) ----------------------
    persona_report = {}
    #: gi -> (blocking finding id, cite, persona). Reported, never silent.
    suppressed_by = {}
    #: (gi, persona) for `structurally_unreachable` with no cite — ignored, loud.
    uncited_claims = []
    #: every capability minted by a member of some contributing slice, so the
    #: provenance block below can say which heuristic tags carried a chain.
    contributing_caps = set()
    for persona, held0 in personas.items():
        path, held = compose(tagged, held0)
        if not path:
            continue
        reached = sorted({c for c in held if is_jewel(c, jewels)})
        fires = bool(reached) and persona in unpriv

        # --- v2.6 story 1.4: evidence-aware escalation ----------------------
        # `contributing_slice()` already walked back from the jewels and dropped
        # bystanders, so every member it returns is load-bearing BY
        # CONSTRUCTION. One member that cannot be reached in any deployed
        # environment therefore means the whole path cannot be walked — no
        # special-casing of the chain "entry" is needed, and a bystander (which
        # is not in this list) cannot suppress a chain it does not carry.
        #
        # Computed BEFORE the persona line is printed so `chain_severity` never
        # advertises a CRITICAL that was in fact declined. A summary field that
        # disagrees with the findings underneath it is how this release's
        # headline defect started.
        contrib_g, blockers = [], []
        if fires:
            contrib = contributing_slice(tagged, path, held0, reached)
            contrib_g = [idx_of[id(tagged[i])] for i in sorted(contrib)]
            for gi in contrib_g:
                contributing_caps |= {normcap(c)
                                      for c in findings[gi]["postconditions"]}
            blockers = [(gi, suppression_evidence(findings[gi]))
                        for gi in contrib_g
                        if suppression_evidence(findings[gi])]

            # A cited blocker only suppresses if it actually breaks EVERY route
            # to the jewel. `contributing_slice()` returns the union of all
            # routes, so on a graph with two independent paths a blocker on
            # route A would otherwise veto route B as well — silencing a live
            # CRITICAL on the strength of an unrelated finding's unreachability.
            # That is the exact failure this gate was built to avoid, so the
            # test is re-composition, not membership: drop the blocked findings
            # and ask whether the jewel is still reached. If it is, the chain
            # stands and nothing is suppressed.
            if blockers:
                blocked = {gi for gi, _ in blockers}
                survivors = [f for f in tagged
                             if idx_of[id(f)] not in blocked]
                _, sheld = compose(survivors, held0)
                sreached = sorted({c for c in sheld if is_jewel(c, jewels)})
                if sreached:
                    blockers = []           # another route survives — still live
                    # Re-slice against the SURVIVING graph rather than filtering
                    # the stale union. Dropping only the citing nodes would leave
                    # every node that was upstream of them — whose sole route is
                    # now severed — still in the slice, and escalate it to
                    # CRITICAL on the strength of a chain the recomposition just
                    # proved dead. Escalate what actually carries a live chain.
                    spath, _ = compose(survivors, held0)
                    scontrib = contributing_slice(survivors, spath, held0, sreached)
                    contrib_g = [idx_of[id(survivors[i])] for i in sorted(scontrib)]

        chain_sev = "INFO"
        for i in path:
            chain_sev = smax(chain_sev, target[idx_of[id(tagged[i])]])
        if fires and not blockers:
            chain_sev = R3_ESCALATION_TARGET
        persona_report[persona] = {
            "reachable": len(path), "chain_severity": chain_sev,
            "crown_jewels_reached": reached, "unprivileged": persona in unpriv,
            "r3_suppressed_by": findings[blockers[0][0]].get("id") if blockers
                                else None,
        }
        if not args.quiet:
            print(f"\nPERSONA {persona}: {len(path)} finding(s) reachable "
                  f"-> chain severity {chain_sev}"
                  f"{'  [UNPRIVILEGED]' if persona in unpriv else ''}")
            for i in path:
                gi = idx_of[id(tagged[i])]
                print(f"    {target[gi]:<8} {str(findings[gi].get('id','?')):<28} "
                      f"{str(findings[gi].get('title',''))[:70]}")
            if reached:
                print(f"    CROWN JEWELS REACHED: {', '.join(reached)}")

        if fires:
            # An uncited `structurally_unreachable` is IGNORED — but never
            # silently. A field that quietly buys a severity concession with no
            # checkable evidence is how `confidence: CONFIRMED` became a 9.6%-
            # true label that bought a rung.
            for gi in contrib_g:
                if uncited_unreachable(findings[gi]):
                    uncited_claims.append((gi, persona))
                    if not args.quiet:
                        print(f"    ! {findings[gi].get('id')} claims "
                              "structurally_unreachable with NO cite — ignored. "
                              "deployment_reachability.evidence (file:line) is "
                              "required before it can suppress anything.")

            if blockers:
                bgi, bcite = blockers[0]
                for gi in contrib_g:
                    if sidx(target[gi]) < SEV_IDX[R3_ESCALATION_TARGET]:
                        # setdefault: report the FIRST persona that hit this, so
                        # the block is stable across persona iteration order.
                        suppressed_by.setdefault(
                            gi, (findings[bgi].get("id"), bcite, persona))
                if not args.quiet:
                    print(f"    R3 SUPPRESSED for this chain by "
                          f"{findings[bgi].get('id')} "
                          f"(structurally_unreachable, cite: {bcite})")
            else:
                for gi in contrib_g:
                    if sidx(target[gi]) < SEV_IDX[R3_ESCALATION_TARGET]:
                        target[gi] = R3_ESCALATION_TARGET
                        rules_fired[gi].add("R3")

            bystanders = [idx_of[id(tagged[i])] for i in path
                          if idx_of[id(tagged[i])] not in contrib_g]
            if bystanders and not args.quiet:
                print(f"    (not escalated — reachable but not contributing: "
                      f"{', '.join(str(findings[b].get('id')) for b in bystanders)})")

    # --- orphan capabilities: the drift alarm -------------------------------
    graph = [f for f in findings if in_capability_graph(f)]
    all_post = {normcap(c) for f in graph for c in f["postconditions"]}
    all_pre = {normcap(c) for f in graph for c in f["preconditions"]}
    persona_caps = {normcap(c) for v in personas.values() for c in v}
    orphan_pre = sorted(p for p in all_pre
                        if not satisfied_by(p, all_post | persona_caps))
    orphan_post = sorted(p for p in all_post
                         if not any(satisfies(p, n) for n in all_pre)
                         and not is_jewel(p, jewels))

    # --- v2.6 story 1.3 (composer half): capability provenance --------------
    #
    # A capability tag used to be an anonymous string. 47% of the calibrated
    # run's 1120 tags were minted by validate-collection-scoping.py, which
    # synthesised `knows:any_<entity>_id`, `reads:any_<entity>_metadata` and
    # `reads:any_<entity>_pii` from the entity name and the profile's pii_cols
    # with NO check that the collection was actually unscoped — and 72 of the 73
    # HIGH+ findings that produced were false. A chain resting on those tags was
    # indistinguishable, in the output, from one resting on a human reading the
    # code. Track A gates the minting; this records where each tag came from so
    # the ones that survive are VISIBLE rather than anonymous.
    minters = {}
    for f in graph:
        for c in f["postconditions"]:
            minters.setdefault(normcap(c), []).append(
                (str(f.get("id") or "?"), evidence_class(f),
                 str(f.get("rule_family") or "")))
    heuristic_minted = {
        cap: srcs for cap, srcs in sorted(minters.items())
        if srcs and all(ec == "heuristic_inventory" for _id, ec, _rf in srcs)
    }

    if (orphan_pre or orphan_post or heuristic_minted) and not args.quiet:
        print("\nORPHAN CAPABILITIES (vocabulary drift alarm — see "
              "lib/capability-lexicon.md §6)")
        for p in orphan_pre[:15]:
            print(f"  precondition never supplied by any finding or persona: {p}")
        for p in orphan_post[:15]:
            print(f"  postcondition feeds nothing and is not a crown jewel: {p}")
        for cap, srcs in list(heuristic_minted.items())[:15]:
            mark = "  [CARRIED AN ESCALATING CHAIN]" if cap in contributing_caps else ""
            who = ", ".join(f"{i} ({rf or 'heuristic'})" for i, _ec, rf in srcs[:3])
            print(f"  capability minted ONLY by heuristic_inventory rows: "
                  f"{cap} <- {who}{mark}")

    # --- Wave 2b.2: orphan annexes — the low-confidence lead list -----------
    #
    # A mechanical row with no judgement twin is the ONLY thing that saw its
    # area. Of the 17 true mechanical findings in the calibrated run, 15 were
    # restatements of a deep-dive finding on the same line — but the rules also
    # enumerated a credential-exfil class's nine distinct legs at exact line
    # granularity, which no agent did. Deleting them trades a mechanical
    # guarantee for an agent's diligence, and 34 missed defects say that trade
    # is bad. So orphans surface, explicitly labelled and capped out of the
    # headline band by the report (§7.2b), rather than being dropped.
    # A DANGLING `annexed_to` is the dangerous case. §7.2's id-dedup runs before
    # §7.2b's annex join, so a parent can be collapsed under a surviving id after
    # a child already pointed at it. Such a row is excluded from the headline
    # band (correctly, it is annexed) AND missed by an orphan test that only asks
    # `annexed_to is None` — so it vanishes from both, which is the silent drop
    # §7.2b's own release-blocking language forbids. Resolve the reference here
    # rather than assuming an upstream validator caught it.
    _known = {str(f.get("id")) for f in findings if f.get("id")}
    for _f in findings:
        for _a in (_f.get("aliases") or []):
            _known.add(str(_a))
    dangling_annex = [f for f in findings
                      if annexed_to(f) is not None
                      and str(annexed_to(f)) not in _known]
    if dangling_annex and not args.quiet:
        print("\nDANGLING ANNEXES (annexed_to names no finding in this corpus — "
              "reclassified as orphans so they cannot vanish silently)")
        for f in dangling_annex[:15]:
            print(f"  {str(f.get('id')):<28} -> {annexed_to(f)}  "
                  f"{f.get('file')}:{f.get('line')}")
    _dangling_ids = {id(f) for f in dangling_annex}

    orphan_annex = [f for f in findings
                    if evidence_class(f) == "heuristic_inventory"
                    and (annexed_to(f) is None or id(f) in _dangling_ids)]
    if orphan_annex and not args.quiet:
        print("\nORPHAN ANNEXES (heuristic rows with no judgement twin — "
              "low-confidence leads, NOT headline findings; see §7.2b)")
        for f in orphan_annex[:15]:
            print(f"  {str(f.get('rule_family') or 'heuristic'):<34} "
                  f"{f.get('file')}:{f.get('line')}  {str(f.get('title',''))[:60]}")

    # --- escalation ledger ---------------------------------------------------
    escalations = [(i, findings[i].get("severity", "INFO"), target[i],
                    sorted(rules_fired[i]))
                   for i in range(len(findings))
                   if sidx(target[i]) > sidx(findings[i].get("severity", "INFO"))]

    # A suppression only stands if the finding did NOT reach CRITICAL by some
    # other route — a second persona's chain, or R1/R2. Fail-open: one blocked
    # path does not license a rating below what another path already earned.
    suppressed = {gi: v for gi, v in suppressed_by.items()
                  if sidx(target[gi]) < SEV_IDX[R3_ESCALATION_TARGET]}

    # --- R4 + lifecycle ------------------------------------------------------
    gov, blocking = governance_checks(findings, baseline, changed, now,
                                      args.run_id, args.max_age_days,
                                      args.strict_closure)

    if escalations and not args.quiet:
        print("\n" + "=" * 72)
        print("SEVERITY ESCALATIONS REQUIRED (severity is computed, not asserted)")
        print("=" * 72)
        for i, was, nowsev, rules in escalations:
            print(f"  [{'/'.join(rules)}] {findings[i].get('id','?')}: {was} -> {nowsev}")
            print(f"          {str(findings[i].get('title',''))[:88]}")

    # --- SUPPRESSED ESCALATIONS ---------------------------------------------
    #
    # Deliberately as loud as ORPHAN CAPABILITIES and the governance gate.
    # Suppression is now the DANGEROUS direction. The calibrated run's worst
    # single defect was not a false positive — it was a wrong refutation, true
    # of one module and generalised to a system property, which filed a live
    # HIGH under a "What is sound" heading readers are told to trust. A false
    # positive costs a triager minutes and is self-correcting; a wrong
    # suppression stops them reading the code and nothing downstream reopens it.
    # Printing every suppression WITH its cite is what stops
    # `deployment_reachability` becoming the next self-asserted CONFIRMED.
    if suppressed and not args.quiet:
        print("\n" + "=" * 72)
        print("SUPPRESSED ESCALATIONS (R3 blocked by cited structural "
              "unreachability)")
        print("=" * 72)
        for gi, (bid, bcite, persona) in sorted(
                suppressed.items(), key=lambda kv: str(findings[kv[0]].get("id"))):
            print(f"  {findings[gi].get('id','?')}: staying {target[gi]} — "
                  f"would have been {R3_ESCALATION_TARGET} "
                  f"(persona {persona})")
            print(f"          {str(findings[gi].get('title',''))[:88]}")
            print(f"          blocked by {bid} "
                  f"[{_SUPPRESSING_REACHABILITY}] cite: {bcite}")
        print("  VERIFY EVERY CITE ABOVE. A wrong suppression buries a live "
              "finding under a heading you are told to trust — the same shape "
              "as a wrong refutation, and nothing downstream reopens it.")

    if gov and not args.quiet:
        print("\n" + "=" * 72)
        print("GOVERNANCE GATE (R4 ratchet + L1-L3 lifecycle)")
        print("=" * 72)
        for g in gov:
            rule = g["sources"][0]["detail"].split(":")[-1]
            print(f"  [{rule}] {g['severity']:<8} {g['title']}")

    # --- outputs -------------------------------------------------------------
    if args.rewrite:
        stamped = []
        for i, f in enumerate(findings):
            g = {k: v for k, v in f.items() if k != "_src"}
            asserted = g.get("severity_asserted") or g.get("severity", "INFO")
            g["severity_asserted"] = asserted
            g["severity_computed"] = target[i]
            if sidx(target[i]) != sidx(g.get("severity", "INFO")):
                hist = list(g.get("severity_history") or [])
                hist.append({
                    "run_id": args.run_id,
                    "severity": target[i],
                    "reason": "attack-path arithmetic: "
                              + ", ".join(sorted(rules_fired[i])),
                    "reason_kind": "chain_escalation",
                    "at": now.isoformat(),
                })
                g["severity_history"] = hist
            # v2.6: stamped whenever a composition rule fired, not only when the
            # severity moved. "Every finding computed CRITICAL names the
            # composition rule that made it so" — an unexplained CRITICAL is
            # what made the calibrated run hard to triage, and 13 of 15 findings
            # in one cluster arrived CRITICAL with 8 of them asserted LOW/INFO.
            if rules_fired[i]:
                g["escalation_rules"] = sorted(rules_fired[i])
            if i in suppressed:
                g["escalation_suppressed_by"] = suppressed[i][0]
            g["severity"] = target[i]
            stamped.append(g)
        args.rewrite.parent.mkdir(parents=True, exist_ok=True)
        args.rewrite.write_text(
            "".join(json.dumps(x) + "\n" for x in stamped), encoding="utf-8")
        if not args.quiet:
            print(f"\nwrote {len(stamped)} finding(s) with computed severity "
                  f"-> {args.rewrite}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text("".join(json.dumps(g) + "\n" for g in gov),
                            encoding="utf-8")
        if not args.quiet:
            print(f"wrote {len(gov)} governance finding(s) -> {args.out}")

    summary = {
        "run_id": args.run_id,
        "findings": len(findings),
        "capability_tagged": len(tagged),
        "escalations": len(escalations),
        "governance_findings": len(gov),
        "governance_blocking": blocking,
        "blocking": bool(escalations or blocking),
        "personas": persona_report,
        "orphan_preconditions": orphan_pre,
        "orphan_postconditions": orphan_post,
        "escalated": [{"id": findings[i].get("id"), "from": was, "to": to,
                       "rules": rules} for i, was, to, rules in escalations],
        # v2.6 story 1.3: which capability tags exist only because a heuristic
        # said so, and whether any of them carried a chain to a crown jewel.
        "heuristic_minted_capabilities": {
            cap: {"minted_by": [i for i, _ec, _rf in srcs],
                  "rule_families": sorted({rf for _i, _ec, rf in srcs if rf}),
                  "in_contributing_slice": cap in contributing_caps}
            for cap, srcs in heuristic_minted.items()},
        # v2.6 story 1.4: never silent. See the SUPPRESSED ESCALATIONS block.
        "suppressed_escalations": [
            {"id": findings[gi].get("id"), "staying": target[gi],
             "would_have_been": R3_ESCALATION_TARGET,
             "blocked_by": bid, "state": _SUPPRESSING_REACHABILITY,
             "evidence": bcite, "persona": persona}
            for gi, (bid, bcite, persona) in sorted(
                suppressed.items(), key=lambda kv: str(findings[kv[0]].get("id")))],
        "uncited_unreachable_claims": sorted(
            {str(findings[gi].get("id")) for gi, _p in uncited_claims}),
        # Wave 2b: the annex split, so the report can band them correctly.
        "annexed_rows": [str(f.get("id")) for f in annexed],
        "dangling_annexes": [str(f.get("id")) for f in dangling_annex],
        "orphan_annexes": [str(f.get("id")) for f in orphan_annex],
    }
    if args.json_summary:
        args.json_summary.parent.mkdir(parents=True, exist_ok=True)
        args.json_summary.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    if escalations or blocking:
        if not args.quiet:
            print(f"\n{len(escalations)} finding(s) must be re-rated and "
                  f"{blocking} governance failure(s) resolved before this report "
                  "is published.")
        return 1
    if not args.quiet:
        print("\nNo escalations required; governance gates clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
