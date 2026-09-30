#!/usr/bin/env python3
"""
validate-egress.py — Authorized-Egress reconciliation (v2.6).

Deterministic core of the "catch any path to sensitive data without permission"
capability. Operates on the Phase-2 inventories:
  - phase-02-sinks.json        (egress sinks, path-sensitive guarded_paths)
  - phase-02-credentials.json  (credential mint/consume ledger)
optionally enriched by:
  - phase-02-surface.json      (interface catalogue — gates on resolve-layer surfaces)
  - phase-00-profile.json      (public_resources allowlist; default-deny otherwise)

Two responsibilities:

  (A) COVERAGE GATE (fail-closed). If a candidate set is supplied (--candidates or
      --source-root, which runs the lib/egress-detection.md extractor), FAIL if any
      candidate sink/credential site is neither inventoried nor explicitly
      dismissed-with-reason, and FAIL on any sink whose `coverage` is "incomplete".
      A silent omission must break the run, never pass quietly.

  (B) RECONCILIATION (R2-R6). Compute, per (resource, LAYER), the strongest
      INTENDED gate (across every path + every credential that protects it), then
      flag every byte-serving branch whose enforced gate is weaker, every
      credential that no byte-serving path consumes, every capability-only branch
      on a sensitive resource, and (v2.6) every credential landing in a filesystem
      location somebody other than the operator can steer. Emits finding-schema
      JSONL.

This is NOT a soundness proof. It mechanically reconciles an AGENT-POPULATED
inventory; its value is (a) it makes the cross-layer / conditional-bypass /
missing-enforcer class EXPRESSIBLE and checkable, and (b) the coverage gate makes a
*missing* sink loud instead of silent. A clean run = "every known egress path was
accounted for and gated", not "no unauthorized path exists".

v2.6 — WHAT THE FIRST CALIBRATED RUN MEASURED. Across 81 triaged HIGH+ R-rule
findings this family was **19.8% true**. The rules were not the problem: the
`floor` was joined on `serves_resource` alone — a free-text string an inventory
agent wrote — so everything sharing that string was compared to everything else
regardless of layer, process or trust boundary. A Vue click handler was compared
against a cron worker's HMAC gate. v2.6 types that join (`layer`), stops a
credential *kind* from setting a floor nobody can reach, gives the inventory
agent a structured way to state a gate's rank, and stops treating a write to the
operator's own stdout/home as egress to an untrusted caller. See
docs/EPIC-v2.6-calibrated-severity.md §1.4.

Usage:
  python3 lib/validate-egress.py <one-or-more .json inputs> \
      [--surface phase-02-surface.json] [--profile phase-00-profile.json] \
      [--candidates candidates.json | --source-root DIR] \
      [--ignore .claude-audit/ignore.txt] \
      [--partition <id>] [--out findings.jsonl] [--quiet]

Inputs may be passed positionally (classified by their top-level keys, so
`tests/fixtures/egress/deck-bug/*.json` works) or via explicit flags.

Exit codes:
  0  clean — coverage satisfied, no HIGH/CRITICAL deficit
  1  coverage gate failed OR >=1 HIGH/CRITICAL Authorized-Egress finding
  2  argparse / I/O / shape error
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

# --- Gate strength ranking --------------------------------------------------
# enforced_gate / intended_gate are free-text descriptions of the gate that IS
# enforced on a path (or "none"). We rank by keyword. Ranks are deliberately
# coarse — the signal is the DELTA between paths to the same resource, not the
# absolute number. Keep this table in sync with lib/egress-detection.md.
GATE_NONE, GATE_AUTHN, GATE_AUTHZ, GATE_VERIFIED = 0, 1, 2, 3

_RANK_KEYWORDS = [
    # (rank, [keywords]) — checked high-to-low; first hit wins.
    (GATE_VERIFIED, ["2fa", "mfa", "otp", "verif", "step-up", "step up",
                     "__sv", "sv_", "email code", "email-code", "share gate",
                     "share-gate", "second factor"]),
    (GATE_AUTHZ, ["role", "rbac", "admin", "permission", "scope", "canaccess",
                  "can_access", "owner", "ownership", "tenant", "org", "acl",
                  "requirerole", "entra", "oidc", "policy", "authorize", "authz"]),
    (GATE_AUTHN, ["auth", "authenticated", "session", "login", "signin",
                  "sign-in", "requireauth", "bearer", "logged in", "logged-in",
                  "jwt", "token valid", "valid token"]),
]

# --- Layer typing (v2.6 story 2.4) -----------------------------------------
# WHY. v2.5 keyed the gate `floor` on `serves_resource` alone. That string is
# free text an inventory agent wrote, so a browser component, a developer CLI, a
# cron worker and an HTTP handler all landed in one comparison bucket the moment
# they named the same entity. Two measured false positives from the calibrated
# run, both silenced by typing the join:
#   * a `console.log(JSON.stringify(summary))` in a developer's own CLI, flagged
#     because the resource's floor came from a CRON SCHEDULER resolve-layer
#     surface;
#   * `ExportCsvButton.vue:31` — a client-side `<a download>` click — flagged for
#     not enforcing a server gate that lives in
#     `server/api/v1/reports/export.get.ts`.
# A Vue click handler cannot enforce a gate and a cron worker's HMAC is not a
# weaker sibling of an HTTP RBAC check. Neither is a bug in the IDEA of R5; both
# are the consequence of joining on an untyped string. [EPIC v2.6 §1.4(c)]
LAYERS = ("http", "browser", "cli", "worker", "build", "ipc")

# The default is `http` on purpose: it is the layer that faces an untrusted
# remote caller, and it is also the bucket every un-typed row landed in before
# v2.6. So an inventory that sets no `layer` anywhere reconciles EXACTLY as v2.5
# did — layer typing can only ever split a bucket, never silently drop a row.
DEFAULT_LAYER = "http"

# Ordered; first match wins. Specific beats generic — `server/workers/` must be
# read as a worker before `server/` is read as an HTTP handler.
#
# `app/` is the trap. It is the browser directory in Nuxt 4 (the calibration
# target) and server code in Rails (`app/controllers`), Laravel (`app/Http`),
# Flask and FastAPI. So `app/` alone means nothing here: the browser rule matches
# `app/` only when followed by a client-shaped subdirectory, and Rails/Laravel's
# server subdirectories are claimed explicitly above it. Anything unrecognised
# falls through to the `http` default, which is the conservative direction —
# `http` is the bucket everything shared before v2.6, so a bad guess costs a
# false positive, never a silent drop. The schemas tell agents to set `layer`
# explicitly wherever the path is ambiguous; this table is only the fallback.
_LAYER_PATH_RULES = [
    ("http", re.compile(r"(^|/)(pages|app|src)/api/|(^|/)server/api/|"
                        r"(^|/)netlify/functions/|(^|/)functions/api/")),
    ("worker", re.compile(r"(^|/)(workers?|jobs?|tasks?|cron|crons|crontab|"
                          r"queues?|consumers?|daemons?|schedulers?)/")),
    ("build", re.compile(r"(^|/)(\.github|\.gitlab|\.circleci)/")),
    ("cli", re.compile(r"(^|/)(scripts?|bin|cli|tools?|hooks?)/|"
                       r"\.(sh|bash|zsh|ps1)$")),
    # Rails / Laravel / Flask server code that lives under app/.
    ("http", re.compile(r"(^|/)app/(controllers|Http|mailers|models|services|"
                        r"channels|serializers|graphql|routes|blueprints|"
                        r"resources|views)/")),
    ("browser", re.compile(r"\.(vue|svelte)$|"
                           r"(^|/)(client|frontend|ui|components|composables|"
                           r"layouts|islands)/|"
                           r"(^|/)(app|src|web|assets)/(components|pages|layouts|"
                           r"composables|stores|islands)/|"
                           r"(^|/)pages/")),
    ("ipc", re.compile(r"(^|/)(electron|preload|main-process|ipc)/")),
    ("http", re.compile(r"(^|/)(server|api|routes|controllers|handlers|"
                        r"endpoints|lambda)/")),
]

# A surface already carries a typed `category` the agent chose deliberately, so
# for surfaces it outranks any guess made from the path.
_SURFACE_CATEGORY_LAYER = {
    "scheduler": "worker", "queue_consumer": "worker",
    "cli_admin": "cli",
    "desktop_ipc": "ipc", "mobile_ipc": "ipc",
}

# Last resort before the default: the partition id itself often names the layer
# ("web-app", "cron-workers", "cli-plugin"). Matched on WHOLE tokens after
# splitting on non-alphanumerics, never as substrings — a substring test reads
# the partition "guide" as a browser layer because it contains "ui", and
# "job-board" as a worker because it contains "job".
_LAYER_PARTITION_TOKENS = [
    ("worker", ("worker", "cron", "job", "queue", "consumer", "scheduler",
                "daemon", "batch")),
    ("cli", ("cli", "script", "plugin", "tool", "hook")),
    ("browser", ("browser", "frontend", "client", "webapp", "ui", "spa")),
    ("build", ("build", "ci", "pipeline")),
    ("ipc", ("electron", "desktop", "ipc")),
]


def infer_layer(explicit, path=None, partition=None, category=None):
    """Resolve the execution layer of a sink/surface.

    Precedence: an explicit `layer` field, then (surfaces only) the typed
    `category`, then the path shape, then a token in the partition id, then
    `http`. Falling back to `http` keeps un-typed inventories in one bucket, so
    adopting this field is purely additive to recall."""
    if explicit:
        e = str(explicit).strip().lower()
        if e in LAYERS:
            return e
    if category:
        mapped = _SURFACE_CATEGORY_LAYER.get(str(category).strip().lower())
        if mapped:
            return mapped
    if path:
        p = _norm(path).lower()
        for layer, rx in _LAYER_PATH_RULES:
            if rx.search(p):
                return layer
    if partition:
        pt = set(re.split(r"[^a-z0-9]+", str(partition).lower()))
        for layer, toks in _LAYER_PARTITION_TOKENS:
            if pt & set(toks):
                return layer
    return DEFAULT_LAYER


# Layers with no second party to authorize. `browser` code executes on the
# caller's own machine — the browser IS the caller — so "did you check this
# caller's role before emitting the bytes?" has no answer there and the gate the
# rule asks for is architecturally impossible. Measured: `ExportCsvButton.vue:31`,
# a client-side `<a download>` click, was filed for not enforcing a gate that
# lives (correctly) in `server/api/v1/reports/export.get.ts`.
#
# Deliberately narrow. `cli`, `worker` and `build` STAY in scope: the calibrated
# run's confirmed-REAL set includes a refresh-grant curl to a repo-chosen host and
# a live access token sent to an unvalidated host, both in plugin scripts. An
# outbound leg that hands a credential to a host somebody else picked is a real
# authorization deficit no matter which process runs it.
_UNGATEABLE_LAYERS = {"browser"}

# Every sink v2.6 removes from the authorization rules is recorded here and
# printed. EPIC §2.1 part 4: "suppression is now the dangerous direction" — the
# same lesson as E1, where a wrong refutation buried a live HIGH under a heading
# readers are told to trust. A quieter tool whose quiet cannot be inspected is
# how `confidence: CONFIRMED` happened; these exclusions do not get to be
# invisible just because they are right.
SUPPRESSION_AUDIT = {"ungateable_layer": set(), "non_network": set()}



# Browser-only FILE EXTENSIONS. Excluding a sink from R2/R3/R5 is a recall
# decision, so it may rest only on evidence that cannot be wrong about the
# question being asked. A `.vue`/`.svelte` file cannot enforce a server-side
# authorization gate no matter where it runs — SSR renders it on the server, but
# the gate still lives in the handler. A DIRECTORY name cannot carry that weight:
# `app/` is the browser in Nuxt and server code in Rails, Laravel and Flask, so a
# directory-inferred `browser` would silently DROP a byte-serving path instead of
# splitting a bucket — the one thing layer typing promised not to do.
_BROWSER_EXTS = (".vue", ".svelte", ".jsx", ".tsx")


def ungateable(row, path, layer):
    """May this row be excluded from the authorization rules entirely?

    True only when the layer is ungateable AND the evidence for it is either
    DECLARED by the inventory agent or a browser-only file extension. An
    exclusion inferred from a directory name is refused: it reconciles normally
    instead, which costs a false positive rather than a miss.
    """
    if layer not in _UNGATEABLE_LAYERS:
        return False
    if str(row.get("layer") or "").strip().lower() in _UNGATEABLE_LAYERS:
        return True
    return _norm(path or "").lower().endswith(_BROWSER_EXTS)


def sink_layer(sink, partition=None):
    return infer_layer(sink.get("layer"), sink.get("sink_file"), partition)


def surface_layer(surface, partition=None):
    return infer_layer(surface.get("layer"),
                       surface.get("handler_file") or surface.get("registration_file"),
                       surface.get("partition") or partition,
                       surface.get("category"))


# --- Egress destination (v2.6 stories 2.5 + 4.3) ---------------------------
# `destination` answers "who receives these bytes", which R2/R3/R5 silently
# assumed was always an untrusted remote caller. Six of 49 sampled R-rule false
# positives were a `writeFileSync(..., {mode: 0o600})` into the device's own home
# or a `console.log` to the invoking developer's own stdout. Neither is egress to
# a caller and neither can carry an authorization gate, so neither belongs in the
# authorization-deficit rules at all. [EPIC v2.6 story 2.5]
DESTINATIONS = ("network", "local_fs", "local_stdout")
DEFAULT_DESTINATION = "network"

# `path_control` answers 4.3's question, which is NOT "is it a file" but "who
# chooses the path". A repo-steerable state directory made a hook write a live
# OAuth access token into an ATTACKER'S working tree — exfil with no network call
# and therefore invisible to every rule in this file before v2.6. So a fixed or
# operator-owned destination is benign (2.5) while the identical write to a path
# an untrusted repo/argv/env/caller can steer is the critical case (4.3).
_SELF_CONTROLLED_PATHS = {"fixed", "own_config"}
_STEERABLE_PATHS = {"caller", "repo", "argv", "env"}


def sink_destination(sink):
    d = str(sink.get("destination") or DEFAULT_DESTINATION).strip().lower()
    return d if d in DESTINATIONS else DEFAULT_DESTINATION


def sink_path_control(sink):
    pc = str(sink.get("path_control") or "unknown").strip().lower()
    if pc in _SELF_CONTROLLED_PATHS or pc in _STEERABLE_PATHS:
        return pc
    return "unknown"


# Credential kind -> the gate strength it IMPLIES for resources it protects.
#
# v2.6 CAP (story 2.6): a kind-derived rank may not exceed GATE_AUTHZ unless a
# real gate TEXT at rank 3 was observed somewhere for that same resource.
# Measured failure: request-scoped Postgres RLS GUCs were inventoried as kind
# `capability`, which mapped to GATE_VERIFIED — a rank only the keywords
# `2fa|mfa|otp|verif|step-up|…` can reach — in an application with no step-up
# auth anywhere. Every resource those GUCs touched got floor 3, so the CORRECTLY
# GATED branch was filed HIGH. A credential kind is a taxonomy label; it is not
# evidence that a rank-3 control exists in the codebase. [EPIC v2.6 §1.4(a)]
_KIND_RANK = {
    "capability": GATE_VERIFIED,
    "signed_url": GATE_VERIFIED,
    "verification": GATE_VERIFIED,
    "session": GATE_AUTHN,
    "jwt": GATE_AUTHN,
    "cookie": GATE_AUTHN,
    "csrf": GATE_AUTHN,
    "api_key": GATE_AUTHZ,
    "pat": GATE_AUTHZ,
    "license": GATE_AUTHZ,
    "feature_flag": GATE_NONE,
}

# Keywords that mean "the only thing protecting this path is knowing an id".
_CAPABILITY_ONLY = ["none", "public", "open", "unauthenticated", "anonymous",
                    "identifier", "id known", "id-known", "knows id", "knows the id",
                    "link exists", "link-exists", "publishlink", "publish link",
                    "share link", "uuid", "guid", "slug", "secret url", "obscurity"]

# NEGATION / no-gate markers. A gate DESCRIPTION that says the control is absent
# must rank GATE_NONE even though it contains positive keywords ("no role check"
# contains "role"; "unauthenticated" contains "auth"). Negation dominates. The
# failure direction is deliberately conservative: an ambiguous/negated gate is
# treated as NO gate, so we over-flag (triaged) rather than miss (the deck bug).
# This makes the ranker robust to free text instead of depending on the agent
# writing the one magic value "none".  [v2.4 P0-1 fix]
_NEGATION = ["none", "no ", "no-", "not ", "without", "missing", "absent",
             "lacks", "lacking", "unauth", "unprotected", "unguarded",
             "anonymous", "public", "open to", "bypass", "skip", "disabled",
             "any caller", "anyone", "everyone", "n/a", "tbd", "unknown",
             "ungated", "no auth", "no gate", "no check", "no verification"]

def _has_negation(t):
    return any(n in t for n in _NEGATION)


# --- Structured rank hint (v2.6 story 2.7) ---------------------------------
# THE BUG THIS CLOSES. The keyword ranker below returns GATE_NONE for text it
# does not recognise. Composed with the kind-derived floor (story 2.6) and the
# severity rule at the bottom of reconcile() — CRITICAL when br == GATE_NONE and
# floor >= GATE_AUTHZ — the emergent behaviour was that **the more precisely an
# analyst described a real control, the more likely it ranked 0 and was filed
# CRITICAL**. Filed CRITICAL in the calibrated run, gate text verbatim:
#
#   "0600 + chmod + atomic rename, with a compare-and-swap against the bytes read
#    so a concurrent redeem's freshly written credential is never clobbered;
#    unparseable JSON aborts rather than rewrites"
#
# — a paragraph of genuine, correct hardening containing not one of the ranker's
# keywords. `gate_rank_hint` gives the inventory agent a structured channel to
# say what it means, and demotes keyword matching to the fallback it always was.
# [EPIC v2.6 §1.4(b)]
_HINT_RANK = {
    "none": GATE_NONE, "0": GATE_NONE,
    "authn": GATE_AUTHN, "1": GATE_AUTHN,
    "authz": GATE_AUTHZ, "2": GATE_AUTHZ,
    "verified": GATE_VERIFIED, "3": GATE_VERIFIED,
}

# The hint is a lever that can only ever make this file QUIETER, so it is
# audited, never silent: main() prints how often it was used and how often it
# contradicted the free text beside it. Making the override loud is what stops
# `gate_rank_hint` becoming the next `confidence: CONFIRMED`.
# Sets, not counters: reconcile() ranks the same branch several times (once to
# decide whether a rank-3 control is observed, once to raise the floor, once to
# measure the branch against it), and a report saying "3 hints applied" when the
# inventory contains one is a report nobody checks twice.
HINT_AUDIT = {"applied": set(), "raised": set(), "contradicted": set()}


def gate_rank(text, hint=None):
    """Rank a gate description. `hint` (a `gate_rank_hint` field) is AUTHORITATIVE
    when present; the keyword ranker is the fallback for inventories that set no
    hint.

    Fallback semantics are unchanged: negation is checked FIRST so a description
    of an ABSENT control (the way an analyst naturally writes it) does not get a
    positive rank from a keyword it happens to contain, and unrecognized text
    falls through to GATE_NONE — conservative by design (fail toward flagging).
    That conservatism is exactly what over-fired on rich, correct descriptions,
    which is why the hint exists."""
    if hint is not None and hint != "":
        r = _HINT_RANK.get(str(hint).strip().lower())
        if r is not None:
            key = (str(hint), str(text or "")[:160])
            HINT_AUDIT["applied"].add(key)
            if r > _keyword_rank(text):
                HINT_AUDIT["raised"].add(key)
                if text and _has_negation(str(text).lower()):
                    # The hint says "gated", the prose says "absent". The hint
                    # still wins (it is the authority), but a disagreement this
                    # sharp is the shape of an inventory error or a suppression
                    # attempt and must not pass unremarked.
                    HINT_AUDIT["contradicted"].add(key)
            return r
    return _keyword_rank(text)


def _keyword_rank(text):
    if not text:
        return GATE_NONE
    t = str(text).lower()
    if _has_negation(t):
        return GATE_NONE
    for rank, kws in _RANK_KEYWORDS:
        if any(k in t for k in kws):
            return rank
    return GATE_NONE


def branch_rank(branch):
    """Rank one guarded_paths[] entry, honouring its gate_rank_hint."""
    return gate_rank(branch.get("enforced_gate"), branch.get("gate_rank_hint"))


def is_capability_only(text, rank=None):
    """True when the only thing 'protecting' the path is knowing an identifier
    (or nothing at all). Any GATE_NONE description on a sensitive resource is a
    candidate capability-URL / ungated path.

    `rank` lets the caller pass the rank it already computed (which may have come
    from a `gate_rank_hint`), so a branch the agent explicitly ranked AUTHZ is not
    then re-ranked from its free text and filed R3 anyway."""
    if not text:
        return True
    t = str(text).lower()
    if (gate_rank(t) if rank is None else rank) > GATE_NONE:
        return False
    # rank is NONE: it is capability-only if it names an id/link/none marker OR
    # is a negated/ungated description (which is, effectively, served on id alone).
    return (any(k in t for k in _CAPABILITY_ONLY)
            or _has_negation(t)
            or t.strip() in ("", "none"))


# --- Input loading / classification ----------------------------------------
def _load(path):
    with open(path) as f:
        return json.load(f)


def classify_inputs(paths):
    """Classify each positional json input by its top-level keys."""
    bag = {"sinks": None, "credentials": None, "surface": None,
           "profile": None, "candidates": None}
    for p in paths:
        try:
            doc = _load(p)
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR: cannot read {p}: {e}", file=sys.stderr)
            sys.exit(2)
        if not isinstance(doc, dict):
            continue
        if "sinks" in doc:
            bag["sinks"] = doc
        elif "credentials" in doc:
            bag["credentials"] = doc
        elif "surfaces" in doc:
            bag["surface"] = doc
        elif "candidates" in doc:
            bag["candidates"] = doc
        elif "data_model" in doc or "public_resources" in doc or "access_mechanisms" in doc:
            bag["profile"] = doc
    return bag


# --- Coverage gate (fail-closed) -------------------------------------------
# v2.6 story 2.8 bug 3: this was `str(p).lstrip("./")`. `lstrip` takes a CHARACTER
# SET, not a prefix, so it ate every leading `.` and `/` — `.output/bundle.js`
# became `output/bundle.js` and `.github/x.yml` became `github/x.yml`. Paths then
# failed to match their inventory entries and the coverage gate raised phantom
# failures. This function is also imported by validate-collection-scoping.py
# (`_norm = _ve._norm`), so it was one bug in two validators; together with bug 2
# (no ignore file) it produced 64 phantom coverage failures that MASKED 7 real
# credential gaps and 129 real collection gaps. A fail-closed gate failing in the
# noisy direction is precisely how a fail-closed gate stops being trusted.
_LEADING_DOTSLASH = re.compile(r"^(?:\./)+")


def _norm(p):
    """Normalise a path for comparison: backslashes to slashes, then strip any
    leading `./` PREFIX (repeated). Deliberately nothing else — `os.path.normpath`
    would also collapse `..` and rewrite `` to `.`, and a leading dot is a
    meaningful part of a directory name (`.output/`, `.github/`, `.claude/`)."""
    return _LEADING_DOTSLASH.sub("", str(p).replace("\\", "/"))


# --- Ignore file (v2.6 story 2.8 bug 2) ------------------------------------
# Only validate-partition-coverage.py read `.claude-audit/ignore.txt`; this file
# and validate-collection-scoping.py did not. Consequence in the calibrated run:
# the extractor walked an unrelated repository the operator had cloned under
# `tmp/` and demanded inventory entries for it. Same flag name, same default,
# same glob semantics as validate-partition-coverage.py, so an operator curates
# one file. Exported at module scope so the collection validator can import them
# rather than growing a third copy.
_DEFAULT_IGNORE_PARTS = {
    ".git", "node_modules", "dist", "build", "target", ".venv", "venv",
    "__pycache__", "vendor", ".next", ".nuxt", ".output", "coverage",
    ".pytest_cache", ".tox", ".gradle", ".idea", ".claude-audit",
}


def glob_to_re(pat):
    """Translate a path glob to a regex. Supports **, *, ?, and character
    classes. `**` crosses directory separators; `*` does not."""
    p = _norm(str(pat).strip())
    out, i = [], 0
    while i < len(p):
        c = p[i]
        if c == "*":
            if p[i:i + 3] == "**/":
                out.append("(?:.*/)?")
                i += 3
                continue
            if p[i:i + 2] == "**":
                out.append(".*")
                i += 2
                continue
            out.append("[^/]*")
            i += 1
            continue
        if c == "?":
            out.append("[^/]")
            i += 1
            continue
        if c == "[":
            j = p.find("]", i)
            if j > i:
                out.append(p[i:j + 1])
                i = j + 1
                continue
        out.append(re.escape(c))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def load_ignore(path):
    pats = []
    if path and Path(path).exists():
        for line in Path(path).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                pats.append(line)
    return pats


def compile_ignore(patterns):
    """Compile ignore globs. A malformed pattern is dropped with a warning rather
    than crashing the run: dropping it fails CLOSED (the tree stays in scope), so
    a typo in ignore.txt can never silently widen what the gate does not see."""
    out = []
    for r in patterns or []:
        try:
            out.append((glob_to_re(r), r))
        except re.error as e:
            print(f"WARNING: ignoring malformed pattern {r!r} in ignore file "
                  f"({e}) — the path stays IN scope", file=sys.stderr)
    return out


def ignored(rel, ignore_res):
    """True if `rel` (a normalised relative path) is out of audit scope."""
    rel = _norm(rel)
    parts = set(Path(rel).parts)
    if parts & _DEFAULT_IGNORE_PARTS:
        return True
    for rx, raw in ignore_res or []:
        if rx.match(rel):
            return True
        # A bare directory pattern like `dist/` ignores the whole subtree.
        if raw.endswith("/") and (rel + "/").startswith(_norm(raw)):
            return True
        if _norm(raw).rstrip("/") in parts:
            return True
    return False


# A candidate is "accounted for" by an inventory/dismissal entry in the SAME file
# whose line is within this many lines (absorbs the drift between the extractor's
# anchor line and the line the agent records for the sink/handler). Line-scoped —
# NOT file-scoped — so one inventoried sink cannot mask another un-inventoried
# sink elsewhere in the same multi-handler file.  [v2.4 P0-2 fix]
_COVERAGE_LINE_TOLERANCE = 15


def _split_site(s):
    """Parse 'file:line' (or 'file') into (file, line|None)."""
    s = _norm(s)
    if ":" in s:
        head, _, tail = s.rpartition(":")
        if tail.isdigit():
            return head, int(tail)
    return s, None


def inventory_deficits(sinks_doc):
    """Fail-closed checks on the SHAPE of the inventory itself, independent of any
    candidate set.

    These live apart from candidate accounting because of a latent hole v2.6
    found: `coverage_failures()` ran only when `--candidates`/`--source-root` was
    supplied, so a `coverage: incomplete` sink — an explicit admission that the
    handler has emitting branches nobody enumerated — passed silently on every
    run without one. A fail-closed gate that only runs half the time is the same
    defect class this whole release is about."""
    fails = []
    sinks = (sinks_doc or {}).get("sinks", [])

    # coverage: incomplete is itself a fail-closed deficit.
    for s in sinks:
        if s.get("coverage") == "incomplete":
            fails.append(
                f"sink {s.get('id', s.get('sink_file'))}: coverage=incomplete "
                "(handler has more emitting branches than guarded_paths records — "
                "fail-closed; enumerate every branch or split the handler)"
            )

    # v2.6 story 4.3: a filesystem sink with no `path_control` is a coverage
    # deficit, not a finding. The whole class turns on that one field — the same
    # `writeFileSync(…, {mode: 0o600})` is benign under the device's own state
    # dir and CRITICAL under a directory the analysed repository named — so an
    # inventory that says "this writes to disk" and stops there has not answered
    # the question. Fail closed rather than manufacture a severity from an
    # unknown, which is how the R-rules got to 19.8%.
    for s in sinks:
        if str(s.get("destination", "")).lower() == "local_fs" and not s.get("path_control"):
            fails.append(
                f"sink {s.get('id', s.get('sink_file'))}: destination=local_fs "
                "with no path_control (record who chooses the destination path — "
                "fixed/own_config is benign, env/argv/repo/caller is exfil; the "
                "same write is both depending on this field)"
            )
    return fails


def coverage_failures(sinks_doc, creds_doc, candidates):
    """Return a list of hard coverage failures (strings). Empty == coverage OK.

    Coverage is LINE-SCOPED: a candidate (file, line) is accounted for only by an
    inventory/dismissal entry in the same file within _COVERAGE_LINE_TOLERANCE
    lines. A file-only dismissal (no line) is a deliberate whole-file dismissal
    (e.g. a generated/vendored file) and covers the file — but a file-only SINK
    does not blanket-cover the file."""
    fails = inventory_deficits(sinks_doc)
    sinks = (sinks_doc or {}).get("sinks", [])

    # (file -> sorted list of accounted lines)  +  whole-file dismissals.
    accounted = {}       # file -> [lines]
    file_dismissed = set()  # files dismissed wholesale (bare 'file', no line)

    def _add(file, line):
        accounted.setdefault(_norm(file), []).append(line)

    for s in sinks:
        _add(s.get("sink_file", ""), s.get("line"))
    for c in (creds_doc or {}).get("credentials", []):
        for site in (c.get("writers", []) + c.get("readers", [])):
            _add(site.get("file", ""), site.get("line"))
    for doc in (sinks_doc, creds_doc):
        for d in (doc or {}).get("dismissed", []):
            f, ln = _split_site(d.get("candidate", ""))
            if ln is None:
                file_dismissed.add(f)
            else:
                _add(f, ln)

    def _is_accounted(cf, cl):
        if cf in file_dismissed:
            return True
        lines = accounted.get(cf)
        if not lines:
            return False
        if cl is None:
            return True  # candidate carries no line; file presence suffices
        return any(al is not None and abs(al - cl) <= _COVERAGE_LINE_TOLERANCE
                   for al in lines)

    # Every deterministic candidate must be accounted for or dismissed,
    # line-scoped.
    for cand in candidates or []:
        cf = _norm(cand.get("file", ""))
        cl = cand.get("line")
        if _is_accounted(cf, cl):
            continue
        fails.append(
            f"UNACCOUNTED candidate {cand.get('kind', '?')} at {cf}"
            f"{':' + str(cl) if cl else ''} — no sink/credential/dismissal within "
            f"{_COVERAGE_LINE_TOLERANCE} lines. The agent must classify every "
            "candidate (silent omission is how the original bug survived)."
        )
    return fails


# --- Deterministic candidate extractor (when --source-root is given) -------
# A compact, language-agnostic subset of lib/egress-detection.md. Pure-python
# (no ripgrep dependency) so CI needs nothing extra.
# Order matters: the first matching pattern wins per line. More specific kinds
# (presigned_url, sse, graphql_field) are listed before the broad db_entity
# serializer. Keep in sync with lib/egress-detection.md; this compiled subset is
# intentionally broad (recall over precision — the agent prunes to dismissed[]).
_EXTRACT_PATTERNS = [
    ("presigned_url", re.compile(r"getSignedUrl\(|\.presign|createPresignedPost\(|"
                                 r"generateSignedUrl\(|generate_presigned_url\(")),
    ("sse", re.compile(r"text/event-stream|res\.write\(\s*['\"]?data:|"
                       r"EventSourceResponse\(|ActionController::Live")),
    ("websocket", re.compile(r"socket\.emit\(|ws\.send\(|\.broadcast\.emit\(")),
    ("graphql_field", re.compile(r"@ResolveField|@FieldResolver|fieldResolver|"
                                 r"def\s+resolve_\w+")),
    ("file", re.compile(r"\bres\.(sendFile|download)\b|\bcreateReadStream\b|"
                        r"\.pipe\(\s*res\b|send_file\b|send_data\b|ServeFile\(|"
                        r"PhysicalFile\(|return\s+File\(|InputStreamResource\(|"
                        r"FileResponse\(")),
    ("stream", re.compile(r"\bsendStream\b|StreamingHttpResponse\(|StreamingResponse\(|"
                          r"StreamingResponseBody|io\.Copy\(\s*w|response\.stream|"
                          r"http\.ServeContent\(")),
    ("static", re.compile(r"express\.static\(|serveStatic\(|ServeContent\(")),
    ("proxy", re.compile(r"createProxyMiddleware\(|http-proxy|\bproxy\(")),
    ("template", re.compile(r"res\.render\(|reply\.view\(|renderToString\(|"
                            r"render\s+(json|plain|html|xml):|\.render\(|render_template\(")),
    ("redirect", re.compile(r"res\.redirect\([^)]*(token|key|data|payload|=)|"
                            r"redirect_to\b|RedirectResponse\(|c\.Redirect\(")),
    ("async_job", re.compile(r"@(KafkaListener|RabbitListener|SqsListener)|"
                             r"\.perform_async\b|@app\.task|@shared_task|"
                             r"exportToCsv\(|generateReport\(|putObject\([^)]*public")),
    ("grpc", re.compile(r"stream\.Send\(|return\s+&pb\.|responseObserver\.onNext\(")),
    ("db_entity", re.compile(r"\bres\.(json|send)\(|reply\.send\(|JsonResponse\(|"
                             r"HttpResponse\(|c\.JSON\(|json\.NewEncoder\(|w\.Write\(|"
                             r"@ResponseBody|ResponseBodyAdvice|ResponseEntity\.(ok|of)\(|"
                             r"Results\.(Json|Ok)\(|return\s+Ok\(")),
]
_CRED_PATTERNS = re.compile(
    r"set-?cookie|cookies\.set\(|res\.cookie\(|jwt\.sign\(|createToken\(|"
    r"getSignedUrl\(|createHmac\(|x-api-key|personal.?access", re.I)

# --- Local-filesystem egress anchors (v2.6 story 4.3) ----------------------
# A repo-steerable state directory made a hook write a live OAuth access token
# into an attacker's working tree. No network call, so nothing in the patterns
# above could see it and the calibrated run missed the class entirely.
#
# DELIBERATELY NARROWER THAN THE REST OF THIS FILE. Every other anchor here is
# broad by doctrine (recall over precision; the agent prunes into dismissed[]),
# but `writeFileSync` is not a rare shape — an unqualified sweep would add
# hundreds of candidates to a fail-closed coverage gate, and story 2.8 is the
# record of what happens when that gate gets noisy: 64 phantom failures masked 7
# real credential gaps and 129 real collection gaps. So a filesystem write only
# becomes a candidate when the same line also names something credential-shaped,
# which is exactly the case the triage found. The residual gap is stated in
# lib/egress-detection.md rather than papered over: a credential persisted via a
# variable named on an earlier line is not caught here and needs the agent.
_FS_WRITE_PATTERNS = re.compile(
    r"\b(writeFileSync|writeFile|createWriteStream|appendFileSync|appendFile|"
    r"outputFile|outputJson|renameSync|copyFileSync)\s*\(|"
    r"\bos\.(WriteFile|Create)\(|\bFile\.WriteAllText\(|\bFiles\.write\(|"
    r"\bFileOutputStream\(|\.write_(text|bytes)\(|\bjson\.dump\(|"
    r"\bFile\.(write|open)\(|\bFileUtils\.(cp|mv)\b")
_CRED_ADJACENT = re.compile(
    r"token|secret|credential|api[_-]?key|passwd|password|bearer|oauth|"
    r"session|cookie|\.pem\b|private[_-]?key|refresh", re.I)
_SOURCE_EXT = {".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", ".py", ".rb",
               ".go", ".java", ".kt", ".cs", ".php"}
_SKIP_DIRS = {"node_modules", ".git", "dist", "build", "vendor", "__pycache__",
              ".venv", "venv", "test", "tests", "__tests__", "spec"}


def extract_candidates(root, ignore_res=None):
    cands = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fn in filenames:
            if Path(fn).suffix not in _SOURCE_EXT:
                continue
            fpath = Path(dirpath) / fn
            rel = _norm(os.path.relpath(fpath, root))
            # v2.6 story 2.8 bug 2 — do not walk into an out-of-scope tree at
            # all. The calibrated run demanded inventory entries for a whole
            # unrelated repository the operator had cloned under `tmp/`.
            if ignored(rel, ignore_res):
                continue
            try:
                lines = fpath.read_text(errors="ignore").splitlines()
            except OSError:
                continue
            for i, line in enumerate(lines, 1):
                for kind, pat in _EXTRACT_PATTERNS:
                    if pat.search(line):
                        cands.append({"file": rel, "line": i, "kind": kind})
                        break
                if _CRED_PATTERNS.search(line):
                    cands.append({"file": rel, "line": i, "kind": "credential"})
                if (_FS_WRITE_PATTERNS.search(line)
                        and _CRED_ADJACENT.search(line)):
                    cands.append({"file": rel, "line": i, "kind": "local_fs"})
    return cands


# --- Reconciliation (R2-R6) -------------------------------------------------
def _byte_branches(sink):
    return [b for b in sink.get("guarded_paths", []) if b.get("serves_bytes")]


def _cwe_facets(cwe):
    """(category, owasp_ids) for an emitted CWE. Kept consistent with
    lib/cwe-map.json's `category` and lib/cwe-owasp-map.json's `canonical`."""
    if cwe in ("CWE-639", "CWE-441"):
        return "idor", ["A01:2025", "API1:2023"]
    if cwe == "CWE-538":
        return "secret_sprawl", ["A02:2025", "API8:2023"]
    if cwe == "CWE-532":
        return "config", ["A02:2025", "API8:2023"]
    return "auth", ["A01:2025", "API5:2023"]


def reconcile(sinks_doc, creds_doc, surface_doc, profile_doc, partition):
    # Reset the hint audit so a second call in one process (tests, or a caller
    # that imports this module) reports its own run rather than a running total.
    for k in HINT_AUDIT:
        HINT_AUDIT[k].clear()
    for k in SUPPRESSION_AUDIT:
        SUPPRESSION_AUDIT[k].clear()
    sinks = (sinks_doc or {}).get("sinks", [])
    creds = (creds_doc or {}).get("credentials", [])
    surfaces = (surface_doc or {}).get("surfaces", []) if surface_doc else []
    public = set((profile_doc or {}).get("public_resources", []) or [])

    # Resource universe.
    resources = set()
    for s in sinks:
        if s.get("serves_resource"):
            resources.add(s["serves_resource"])
    for c in creds:
        for r in c.get("protects_resources", []):
            resources.add(r)

    findings = []
    seq = 0

    def mk(rule, resource, sev, cwe, file, line, title, desc, probe=None):
        nonlocal seq
        seq += 1
        cat, owasp = _cwe_facets(cwe)
        f = {
            "id": f"{partition}:egress:{seq:04d}",
            "severity": sev,
            # v2.6: was hardcoded "CONFIRMED" — asserted at EMISSION, before
            # anything had been attacked, on every row this file produces. The
            # R-rules measured 19.8% true over a calibrated run. LIKELY is the
            # honest ceiling for a rule reconciling an agent-written inventory;
            # the §6.19 adversarial pass may still refute it, and `attacked`
            # (not `confidence`) is where that outcome now lands.
            "confidence": "LIKELY",
            "evidence_class": "heuristic_inventory",
            "rule_family": f"validate-egress:{rule}",
            "category": cat,
            "partition": partition,
            "file": file or "<unknown>",
            "line": int(line) if line else 1,
            "cwe": cwe,
            "owasp_ids": owasp,
            "title": title[:120],
            "description": desc[:800],
            "sources": [{"kind": "heuristic", "detail": f"validate-egress.py:{rule}"}],
            "remediation_effort": "small",
        }
        if probe:
            f["verification_probe"] = probe
        return f

    # Credential WRITER sites, indexed by file. Used by R6 to decide "this
    # filesystem write puts a CREDENTIAL on disk" from the ledger the agent
    # already wrote, rather than inventing a second inventory field the agent
    # would have to remember to set.
    cred_writer_sites = {}
    for c in creds:
        for w in c.get("writers", []) or []:
            cred_writer_sites.setdefault(_norm(w.get("file", "")), []).append(
                (w.get("line"), c))

    def credential_written_by(sink):
        """The credential this sink writes, if the ledger has a writer at the
        same (file, ~line). Line-scoped with the same tolerance as the coverage
        gate, so an unrelated write elsewhere in the file is not conflated."""
        sl = sink.get("line")
        for ln, c in cred_writer_sites.get(_norm(sink.get("sink_file", "")), []):
            if ln is None or sl is None:
                return c
            if abs(int(ln) - int(sl)) <= _COVERAGE_LINE_TOLERANCE:
                return c
        return None

    for r in sorted(resources):
        sinks_for_r = [s for s in sinks if s.get("serves_resource") == r]
        creds_for_r = [c for c in creds if r in c.get("protects_resources", [])]
        surfaces_for_r = [sf for sf in surfaces if sf.get("serves_resource") == r]
        sensitive = r not in public  # default-deny

        # Story 2.5: only a `network` sink emits to a caller who could be asked
        # for a credential. A write to the operator's own home and a print to the
        # operator's own stdout are handled by R6 below, and are excluded from
        # the AUTHORIZATION rules entirely — there is no caller to authorize.
        # Story 2.4: likewise a layer with no second party (see
        # _UNGATEABLE_LAYERS). Both exclusions apply to the FLOOR as well as to
        # the deficit check — browser code cannot declare a server-side gate any
        # more than it can enforce one.
        net_sinks = []
        for s in sinks_for_r:
            sid = f"{s.get('id')} ({s.get('sink_file')}:{s.get('line')})"
            if sink_destination(s) != "network":
                SUPPRESSION_AUDIT["non_network"].add(
                    f"{sid} destination={sink_destination(s)}")
            elif ungateable(s, s.get("sink_file"), sink_layer(s, partition)):
                SUPPRESSION_AUDIT["ungateable_layer"].add(
                    f"{sid} layer={sink_layer(s, partition)}"
                    f"{'' if s.get('layer') else ' (inferred from file type)'}")
            else:
                net_sinks.append(s)
        gated_surfaces = [
            sf for sf in surfaces_for_r
            if not ungateable(sf,
                              sf.get("handler_file") or sf.get("registration_file"),
                              surface_layer(sf, partition))]

        # --- Story 2.6: is a rank-3 control OBSERVED for r, in gate TEXT? ----
        # A credential KIND is a taxonomy label. Only an actual gate description
        # (or an explicit gate_rank_hint) is evidence that a step-up control
        # exists for this resource. Resource-scoped rather than layer-scoped on
        # purpose: the question the calibration posed is "does this application
        # have a rank-3 control for r at all", and it did not.
        observed = [gate_rank(s.get("intended_gate"), s.get("gate_rank_hint"))
                    for s in sinks_for_r]
        for s in sinks_for_r:
            observed += [branch_rank(b) for b in s.get("guarded_paths", []) or []]
        for sf in surfaces_for_r:
            observed.append(gate_rank(sf.get("intended_gate"),
                                      sf.get("gate_rank_hint")))
            observed += [branch_rank(b) for b in sf.get("guarded_paths", []) or []]
        for c in creds_for_r:
            observed += [gate_rank(v)
                         for v in c.get("validation_at_readers", []) or []]
        rank3_observed = any(x >= GATE_VERIFIED for x in observed)

        # --- gate_floor(r, LAYER) = strongest gate observed for r AT THAT LAYER.
        floors = {}  # layer -> (rank, source description)

        def bump(layer, rank, src, tie=False):
            cur = floors.get(layer, (GATE_NONE, "none"))[0]
            if rank > cur or (tie and rank >= cur and rank > GATE_NONE):
                floors[layer] = (rank, src)

        # ...from any sink intended_gate / strongest enforced branch, same layer
        for s in net_sinks:
            L = sink_layer(s, partition)
            bump(L, gate_rank(s.get("intended_gate"), s.get("gate_rank_hint")),
                 f"intended_gate of {s.get('id')}")
            for b in s.get("guarded_paths", []):
                bump(L, branch_rank(b),
                     f"sibling branch {b.get('branch_id')} of {s.get('id')}")

        layers_for_r = {sink_layer(s, partition) for s in net_sinks}
        layers_for_r |= {surface_layer(sf, partition) for sf in gated_surfaces}
        if not layers_for_r:
            layers_for_r = {DEFAULT_LAYER}

        # ...from credentials protecting r. DELIBERATE ASYMMETRY: a credential is
        # NOT layer-scoped. `protects_resources` is a declaration about the
        # resource, not about a code layer, and layer-scoping it would silence the
        # genuine "the credential exists but this leg never presents it" class —
        # the one real thing this family found. The control on this path is the
        # story-2.6 cap, not the join.
        for c in creds_for_r:
            kind_rank = _KIND_RANK.get(c.get("kind", ""), GATE_NONE)
            src = f"credential {c.get('name')} ({c.get('kind')})"
            if kind_rank > GATE_AUTHZ and not rank3_observed:
                kind_rank = GATE_AUTHZ
                src += (f" — kind-derived rank capped at AUTHZ: no rank-3 gate "
                        f"text is observed anywhere for {r}")
            val_rank = max([gate_rank(v)
                            for v in c.get("validation_at_readers", []) or []]
                           or [GATE_NONE])
            for L in layers_for_r:
                bump(L, max(kind_rank, val_rank), src)

        # ...from surfaces that serve r (incl. resolve-layer surfaces — R5's
        # source). Evaluated LAST so a resolve-layer gate wins ties: when the gate
        # lives on a non-byte-serving (resolve/identify) surface, the deficit is
        # the cross-layer class and is labelled R5.
        for sf in gated_surfaces:
            L = surface_layer(sf, partition)
            ig = gate_rank(sf.get("intended_gate"), sf.get("gate_rank_hint"))
            for b in sf.get("guarded_paths", []) or []:
                ig = max(ig, branch_rank(b))
            serves_bytes = any(o in ("read", "write", "delete", "exec")
                               and sf.get("emits_bytes") for o in sf.get("data_ops", []))
            is_resolve_layer = not serves_bytes
            if is_resolve_layer:
                bump(L, ig, f"resolve-layer surface {sf.get('id')}", tie=True)
            else:
                bump(L, ig, f"surface {sf.get('id')}")

        # Per byte-serving branch: a deficit is a branch whose enforced gate is
        # weaker than the floor FOR ITS OWN LAYER. We do NOT infer credential
        # "consumption" from substring-in-gate-text (a credential consumed in
        # middleware is not named at the sink line — that produced false positives
        # on correctly-gated resources). Instead, the credential already RAISED the
        # floor; an ungated/under-gated byte path is therefore caught here as a
        # deficit (R5/R2), and a never-read credential is caught by R4 below.
        # [v2.4 P0-3 fix: removed substring-consumption R1]
        for s in net_sinks:
            L = sink_layer(s, partition)
            floor, floor_src = floors.get(L, (GATE_NONE, "none"))
            if not sensitive and floor == GATE_NONE:
                continue  # explicitly public and nothing implies a gate
            # v2.6 story 2.8 bug 1: this was
            #   s.get('reachable_via', ['<path>'])[0]
            # and `.get(k, default)` returns the default only when the key is
            # MISSING — a sink whose reachable_via was present-but-empty raised
            # IndexError. That crashed §6.19 outright in the calibrated run, so
            # the flagship v2.4 control produced nothing at all.
            reach = [x for x in (s.get("reachable_via") or []) if x] or ["<path>"]
            for b in _byte_branches(s):
                br = branch_rank(b)
                gate_txt = (b.get("enforced_gate") or "none")
                probe = {
                    "request": f"curl -i '<base>{reach[0]}' "
                               "   # attacker capability: knows the id, presents NO credential",
                    "expected": "401 or 404 (denied)",
                    "actual": None,
                }
                deficit = br < floor
                cap_only = sensitive and is_capability_only(gate_txt, br)
                if deficit:
                    # R5/R2: cross-layer / asymmetric gate deficit (CWE-862).
                    sev = "CRITICAL" if (br == GATE_NONE and floor >= GATE_AUTHZ) else "HIGH"
                    findings.append(mk(
                        "R5" if "resolve-layer" in floor_src else "R2",
                        r, sev, "CWE-862", s.get("sink_file"),
                        b.get("line") or s.get("line"),
                        f"Byte-serving path to {r} enforces a weaker gate than the resource requires",
                        f"Sink {s.get('id')} branch '{b.get('branch_id')}' emits {r} bytes with gate "
                        f"'{gate_txt}' (rank {br}) at the {L} layer, but {r}'s strongest declared gate "
                        f"AT THE {L} LAYER is rank {floor} (from {floor_src}). A caller taking this "
                        f"branch retrieves {r} without the intended authorization — the "
                        f"control-with-no-enforcer / cross-layer class.",
                        probe,
                    ))
                if cap_only:
                    # R3: capability-only / ungated byte path on a sensitive
                    # resource (CWE-639 — distinct facet from R5's CWE-862, so it
                    # survives Phase-7 dedup and adds the id-is-not-secret framing).
                    findings.append(mk(
                        "R3", r, "HIGH", "CWE-639", s.get("sink_file"),
                        b.get("line") or s.get("line"),
                        f"Capability-only gate: {r} served on knowledge of an identifier alone",
                        f"Sink {s.get('id')} branch '{b.get('branch_id')}' serves {r} bytes gated only by "
                        f"'{gate_txt}'. If the identifier is handed to clients (DOM/URL/logs/Referer) the "
                        f"control collapses to id-secrecy. Treat the identifier as non-secret and enforce "
                        f"the resource's real gate.",
                        probe,
                    ))

        # --- R6: egress that never touches the network (v2.6 story 4.3) ------
        # A repo-steerable state directory made a hook write a live OAuth access
        # token into an ATTACKER'S working tree. No network call, so no rule in
        # this file could see it, and the calibrated run missed it entirely —
        # the triagers rated it CRITICAL. The discriminator is NOT "is it a file"
        # (story 2.5's benign `0600` write to the device's own home is also a
        # file) but WHO CHOOSES THE PATH.
        for s in sinks_for_r:
            dest = sink_destination(s)
            if dest == "network":
                continue
            cred = credential_written_by(s)
            carries = bool(s.get("carries_credential")) or cred is not None
            cred_name = (s.get("carries_credential_name")
                         or (cred or {}).get("name") or "a credential")
            pc = sink_path_control(s)
            L = sink_layer(s, partition)
            site_line = s.get("line")

            if dest == "local_stdout":
                # Story 2.5: a print to the invoking operator's own stdout is not
                # egress and gets no authorization finding. It is only reportable
                # when the ledger says a CREDENTIAL is what is being printed —
                # stdout is captured by CI logs, hook transcripts and terminal
                # scrollback. MEDIUM: below the HIGH+ gate, so it informs without
                # failing the run.
                if carries:
                    findings.append(mk(
                        "R6", r, "MEDIUM", "CWE-532", s.get("sink_file"), site_line,
                        f"Credential '{cred_name}' written to stdout by {s.get('id')}",
                        f"Sink {s.get('id')} ({L} layer) writes {r} to stdout and the credential "
                        f"ledger records '{cred_name}' as minted at this site. Stdout is not a "
                        f"caller-facing channel — no authorization gate applies — but it is "
                        f"captured verbatim by CI logs, hook transcripts and shell history. "
                        f"Redact the credential or write it to the private state file instead.",
                    ))
                continue

            if pc in _SELF_CONTROLLED_PATHS:
                # THE SHAPE STORY 2.5 EXISTS TO SILENCE: writeFileSync(path,
                # {mode: 0o600}) under the device's own home. Six of 49 sampled
                # R-rule false positives were exactly this.
                continue

            if pc == "unknown":
                # Fail-closed, but quietly: an undetermined path is a gap in the
                # INVENTORY, not evidence of a defect, so it must not manufacture
                # a HIGH. MEDIUM keeps it visible and tells the agent what to go
                # and record.
                if carries:
                    findings.append(mk(
                        "R6", r, "MEDIUM", "CWE-538", s.get("sink_file"), site_line,
                        f"Credential '{cred_name}' written to a filesystem path of undetermined provenance",
                        f"Sink {s.get('id')} ({L} layer) writes {r} to the filesystem and the ledger "
                        f"records '{cred_name}' as minted here, but `path_control` is unset — so it is "
                        f"not known whether the destination is the device's own state directory or a "
                        f"location an untrusted repository/argv/env can steer. Record path_control; "
                        f"the two cases differ by three severity rungs.",
                    ))
                continue

            # pc is caller/repo/argv/env — somebody other than the operator has a
            # say in where these bytes land.
            if not (carries or sensitive):
                continue
            sev = "CRITICAL" if carries else "HIGH"
            findings.append(mk(
                "R6", r, sev, "CWE-538", s.get("sink_file"), site_line,
                (f"Credential '{cred_name}' lands in a {pc}-steerable filesystem path"
                 if carries else
                 f"{r} lands in a {pc}-steerable filesystem path"),
                f"Sink {s.get('id')} ({L} layer) writes {r} to a path controlled by `{pc}`"
                + (f", and the ledger records '{cred_name}' as minted at this site" if carries else "")
                + f". This is egress with no network call: whoever chooses the path chooses the "
                f"reader. The v2.5 rule set modelled network modalities only, so this class was "
                f"invisible — a repo-steerable state directory that made a hook write a live "
                f"access token into an attacker's own working tree was missed entirely. Anchor "
                f"the destination to an operator-owned directory (path_control: fixed/own_config) "
                f"and keep the restrictive mode.",
            ))

        # R4 (pure theatre): a credential is minted (writers != []) but has NO
        # reader ANYWHERE (readers == []). An issued credential with zero consumers
        # is not a control. FP-safe: a credential read in middleware has readers !=
        # [] and is NOT flagged here.  [v2.4 P0-3 fix: was substring-based]
        max_floor = max([v[0] for v in floors.values()] or [GATE_NONE])
        if sensitive or max_floor > GATE_NONE:
            for c in creds_for_r:
                if c.get("writers") and not c.get("readers"):
                    findings.append(mk(
                        "R4", r, "HIGH", "CWE-862",
                        (c.get("writers") or [{}])[0].get("file"),
                        (c.get("writers") or [{}])[0].get("line"),
                        f"Credential '{c.get('name')}' minted but has zero consumers (theatre) for {r}",
                        f"Credential '{c.get('name')}' ({c.get('kind')}) is written "
                        f"({len(c.get('writers', []))} writer(s)) but read NOWHERE (0 readers) while it is "
                        f"declared to protect {r}. An issued credential with no consumer is not a control.",
                    ))

    return findings


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("inputs", nargs="*", type=Path,
                    help="One or more json inputs (classified by top-level keys).")
    ap.add_argument("--sinks", type=Path)
    ap.add_argument("--credentials", type=Path)
    ap.add_argument("--surface", type=Path)
    ap.add_argument("--profile", type=Path)
    ap.add_argument("--candidates", type=Path,
                    help="JSON {candidates:[{file,line,kind}]} for the coverage gate.")
    ap.add_argument("--source-root", type=Path,
                    help="Run the deterministic extractor over this source tree for coverage.")
    ap.add_argument("--ignore", type=Path,
                    default=Path(".claude-audit/ignore.txt"),
                    help="Out-of-scope path globs, one per line. Same flag, "
                         "default and semantics as validate-partition-coverage.py "
                         "so one curated file governs every gate. [v2.6 story 2.8]")
    ap.add_argument("--partition", default="global")
    ap.add_argument("--out", type=Path, help="Write findings JSONL here.")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    bag = classify_inputs(args.inputs)
    if args.sinks:
        bag["sinks"] = _load(args.sinks)
    if args.credentials:
        bag["credentials"] = _load(args.credentials)
    if args.surface:
        bag["surface"] = _load(args.surface)
    if args.profile:
        bag["profile"] = _load(args.profile)
    if args.candidates:
        bag["candidates"] = _load(args.candidates)

    if bag["sinks"] is None and bag["credentials"] is None:
        print("ERROR: no sinks or credentials inventory supplied.", file=sys.stderr)
        sys.exit(2)

    # Coverage candidates. [v2.6 story 2.8 bug 2] The ignore file is applied to
    # BOTH sources — a hand-supplied candidate list can name an out-of-scope tree
    # just as easily as the walker can find one.
    ignore_res = compile_ignore(load_ignore(args.ignore))
    candidates = None
    ignored_n = 0
    if bag["candidates"]:
        raw = bag["candidates"].get("candidates", [])
        candidates = [c for c in raw if not ignored(c.get("file", ""), ignore_res)]
        ignored_n = len(raw) - len(candidates)
    elif args.source_root:
        if not args.source_root.exists():
            print(f"ERROR: --source-root not found: {args.source_root}", file=sys.stderr)
            sys.exit(2)
        candidates = extract_candidates(args.source_root, ignore_res)

    # Inventory-shape deficits are checked on EVERY run; candidate accounting
    # only when a candidate set was supplied. Before v2.6 both lived behind the
    # candidate check, so `coverage: incomplete` — the inventory explicitly
    # admitting it is partial — passed silently whenever no --source-root was
    # given.
    cov_fails = (coverage_failures(bag["sinks"], bag["credentials"], candidates)
                 if candidates is not None
                 else inventory_deficits(bag["sinks"]))

    findings = reconcile(bag["sinks"], bag["credentials"], bag["surface"],
                         bag["profile"], args.partition)

    if args.out:
        with open(args.out, "w") as f:
            for row in findings:
                f.write(json.dumps(row) + "\n")

    high_crit = [f for f in findings if f["severity"] in ("HIGH", "CRITICAL")]

    if not args.quiet:
        print(f"Authorized-Egress reconciliation ({args.partition}):")
        print(f"  coverage candidates checked: "
              f"{len(candidates) if candidates is not None else 'n/a (no candidates supplied)'}")
        if ignored_n:
            print(f"  candidates dropped by {args.ignore}: {ignored_n}")
        print(f"  coverage failures: {len(cov_fails)}")
        for cf in cov_fails[:30]:
            print(f"    ✗ {cf}", file=sys.stderr)
        print(f"  findings: {len(findings)} "
              f"({sum(1 for f in findings if f['severity']=='CRITICAL')} CRITICAL, "
              f"{sum(1 for f in findings if f['severity']=='HIGH')} HIGH)")
        for f in findings:
            print(f"    [{f['severity']}] {f['sources'][0]['detail']} {f['cwe']} — {f['title']}")
        # P1-7: default-deny visibility. If no public_resources allowlist was
        # supplied, EVERY served resource is treated as sensitive — say so, so a
        # triager knows R3 noise on genuinely-public resources is expected and the
        # fix is to curate the allowlist (not to weaken the rule).
        if not (bag["profile"] or {}).get("public_resources"):
            print("  NOTE: no public_resources allowlist supplied — default-deny is "
                  "in FULL effect (every served resource treated as sensitive). "
                  "Curate profile.public_resources to suppress findings on "
                  "intentionally-public data.")
        # v2.6 story 2.7. `gate_rank_hint` can only make this file quieter, so it
        # is never applied silently: report how often the inventory overrode the
        # ranker and how often the override contradicted the prose beside it.
        # Making the lever loud is what stops it becoming the next `CONFIRMED`.
        # SUPPRESSED SINKS — v2.6 removed two populations from R2/R3/R5. Both are
        # listed, never merely counted: an exclusion nobody can inspect is how
        # `confidence: CONFIRMED` survived three releases.
        nn, ul = SUPPRESSION_AUDIT["non_network"], SUPPRESSION_AUDIT["ungateable_layer"]
        if nn or ul:
            print(f"  SUPPRESSED SINKS (evaluated by R6, not by R2/R3/R5): "
                  f"{len(nn)} non-network, {len(ul)} in a layer with no caller "
                  f"to authorize")
            for row in sorted(nn)[:10]:
                print(f"    · not egress to a caller — {row}")
            for row in sorted(ul)[:10]:
                print(f"    · nothing there can enforce a gate — {row}")
        if HINT_AUDIT["applied"]:
            print(f"  gate_rank_hint: {len(HINT_AUDIT['applied'])} applied, "
                  f"{len(HINT_AUDIT['raised'])} raised a rank the keyword ranker "
                  f"would not have given, "
                  f"{len(HINT_AUDIT['contradicted'])} contradict their own gate text")
            for hint, txt in sorted(HINT_AUDIT["contradicted"])[:10]:
                print(f"    ! hint '{hint}' overrides gate text that describes an "
                      f"ABSENT control: \"{txt[:120]}\"", file=sys.stderr)
        if args.out:
            print(f"  wrote: {args.out}")

    if cov_fails:
        if not args.quiet:
            print("=== FAIL — coverage gate (fail-closed): "
                  "unaccounted egress candidates ===", file=sys.stderr)
        sys.exit(1)
    if high_crit:
        if not args.quiet:
            print(f"=== FAIL — {len(high_crit)} HIGH/CRITICAL Authorized-Egress "
                  "finding(s) ===", file=sys.stderr)
        sys.exit(1)
    if not args.quiet:
        print("=== PASS — every known egress path accounted for and gated "
              "(NOT a proof of absence) ===")
    sys.exit(0)


if __name__ == "__main__":
    main()
