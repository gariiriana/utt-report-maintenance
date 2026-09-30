#!/usr/bin/env python3
"""
validate-partition-coverage.py — Phase-1 partition coverage gate (v2.5).

WHY THIS EXISTS
---------------
In the 2026-07-25 audit that missed a CRITICAL authorization defect, one of the
three independent reasons it was missed was pure bookkeeping:

    server/api/content/  matched NO partition path-glob and fell through
    silently — "explicit partition membership: NONE". Its nearest partition
    ranked #9 against a default top_n of 8, so even that would have been
    inventory-only.

An entire directory of HTTP handlers left the audit without a word. Partition
coverage was ASSUMED; it was never ASSERTED.

This script asserts it. Every non-ignored source file must map to at least one
partition's `paths_included`. Unmatched files FAIL Phase 1 rather than landing in
a catch-all. It additionally reports:

  - CATCH-ALL partitions (a bare `**` alongside specific partitions) — the shape
    that turns "unmatched" into "silently swallowed";
  - the DEEP-DIVE CUT LINE — which partitions fell below top_n, how many source
    files they contain, and therefore what the run consciously chose not to
    deep-dive. A budget decision is fine; an invisible budget decision is not.

Usage:
  python3 validate-partition-coverage.py partitions.json \
      [--source-root .] [--ignore .claude-audit/ignore.txt] \
      [--out coverage.json] [--fail-on-multi] [--quiet]

Exit codes:
  0  every source file maps to a partition
  1  at least one unmatched file (or a multi-match with --fail-on-multi)
  2  argparse / I/O / shape error
"""
import argparse
import json
import re
import sys
from pathlib import Path


# v2.6: `lstrip("./")` takes a CHARACTER SET, not a prefix — so `.output/x`
# became `output/x`, `./.env` became `env`, and any path whose first component
# starts with a dot was silently rewritten into a different path. Shipped in
# v2.5 and, together with the missing ignore-file support, produced 64 phantom
# coverage failures that masked 7 real credential gaps and 129 real collection
# gaps. Fail-closed gates failing in the NOISY direction is the specific way a
# fail-closed gate stops being trusted.
#
# The calibration analysis filed this as one bug in one file. A repo-wide sweep
# for the shape found ten call sites across three modules — which is the
# release's own §1.6 lesson ("the tool finds instances, not classes") landing on
# the release itself.
_DOT_PREFIX_RE = re.compile(r"^(?:\./)+")


def _strip_dot_prefix(s):
    """Strip leading `./` path prefixes. Never touches a leading dot that is
    part of a real name (`.github/`, `.output/`, `.env`)."""
    return _DOT_PREFIX_RE.sub("", str(s))

# Extensions that carry application logic. A file outside this set cannot hide a
# handler, so leaving it unpartitioned is not a coverage hole.
_SOURCE_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte",
    ".py", ".rb", ".php", ".java", ".kt", ".kts", ".scala", ".cs", ".go",
    ".rs", ".ex", ".exs", ".erl", ".swift", ".m", ".mm", ".c", ".cc", ".cpp",
    ".h", ".hpp", ".graphql", ".gql", ".proto", ".sql",
}
_DEFAULT_IGNORE_PARTS = {
    ".git", "node_modules", "dist", "build", "target", ".venv", "venv",
    "__pycache__", "vendor", ".next", ".nuxt", ".output", "coverage",
    ".pytest_cache", ".tox", ".gradle", ".idea", ".claude-audit",
}


def glob_to_re(pat):
    """Translate a path glob to a regex. Supports **, *, ?, and character
    classes. `**` crosses directory separators; `*` does not."""
    p = _strip_dot_prefix(str(pat).strip())
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


_CATCH_ALL_PROBES = ("a/b/c/d.ts", "x/y.py", "zz/qq/rr/ss/tt.go", "top.rb")


def is_catch_all(pat):
    """Behavioural, not a spelling allowlist.

    The first version listed four literal spellings ("**", "**/*", "*", "./**").
    `*/**` compiles to `^[^/]*/.*$`, matches every file below any top-level
    directory, and was invisible to it — so the whole gate was bypassable by a
    one-character variant. Compile the glob and ask what it actually matches."""
    raw = _strip_dot_prefix(str(pat).strip())
    if raw in ("**", "**/*", "*", "./**"):
        return True
    try:
        rx = glob_to_re(raw)
    except re.error:
        return False
    # MAJORITY, not all: `*/**` matches everything under any top-level directory
    # but not a root-level file, so requiring every probe let it through — the
    # exact evasion this check exists to close. A directory-anchored glob like
    # `src/**` matches none of the probes, so the threshold is not close.
    hits = sum(1 for probe in _CATCH_ALL_PROBES if rx.match(probe))
    return hits >= max(2, len(_CATCH_ALL_PROBES) - 1)


def load_ignore(path):
    pats = []
    if path and Path(path).exists():
        for line in Path(path).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                pats.append(line)
    return pats


def ignored(rel, ignore_res):
    parts = set(Path(rel).parts)
    if parts & _DEFAULT_IGNORE_PARTS:
        return True
    for rx, raw in ignore_res:
        if rx.match(rel):
            return True
        # A bare directory pattern like `dist/` ignores the whole subtree.
        if raw.endswith("/") and (rel + "/").startswith(_strip_dot_prefix(raw)):
            return True
        if raw.rstrip("/") in parts:
            return True
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("partitions", type=Path)
    ap.add_argument("--source-root", type=Path, default=Path("."))
    ap.add_argument("--ignore", type=Path,
                    default=Path(".claude-audit/ignore.txt"))
    ap.add_argument("--out", type=Path)
    ap.add_argument("--fail-on-multi", action="store_true",
                    help="Also fail when a file matches more than one partition. "
                         "Off by default — workflow.md §1.6 resolves overlaps by "
                         "highest risk, but the overlap is always reported.")
    ap.add_argument("--allow-catch-all", action="store_true",
                    help="Permit a catch-all glob alongside specific partitions. "
                         "Off by default: a catch-all makes the coverage gate "
                         "report success unconditionally.")
    ap.add_argument("--max-report", type=int, default=40)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    try:
        doc = json.loads(args.partitions.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: cannot read {args.partitions}: {e}", file=sys.stderr)
        return 2

    parts = doc.get("partitions", doc if isinstance(doc, list) else [])
    if not parts:
        print("ERROR: partitions.json contains no partitions[].", file=sys.stderr)
        return 2

    compiled, catch_alls = [], []
    for p in parts:
        pid = p.get("id", "?")
        globs = p.get("paths_included") or ([p["path"] + "/**"] if p.get("path") else [])
        for g in globs:
            if is_catch_all(g):
                catch_alls.append((pid, g))
            compiled.append((pid, g, glob_to_re(g)))
        # A partition path with no trailing /** still owns its subtree.
        if p.get("path"):
            base = str(p["path"]).strip("/")
            if base and base != ".":
                compiled.append((pid, base + "/**", glob_to_re(base + "/**")))

    ignore_raw = load_ignore(args.ignore)
    ignore_res = [(glob_to_re(r), r) for r in ignore_raw]

    root = args.source_root
    if not root.is_dir():
        print(f"ERROR: --source-root not a directory: {root}", file=sys.stderr)
        return 2

    unmatched, multi, per_partition = [], [], {}
    total = 0
    for f in sorted(root.rglob("*")):
        if not f.is_file() or f.suffix not in _SOURCE_EXT:
            continue
        rel = str(f.relative_to(root)).replace("\\", "/")
        if ignored(rel, ignore_res):
            continue
        total += 1
        hits = sorted({pid for pid, _g, rx in compiled if rx.match(rel)})
        if not hits:
            unmatched.append(rel)
        else:
            if len(hits) > 1:
                multi.append({"file": rel, "partitions": hits})
            for h in hits:
                per_partition[h] = per_partition.get(h, 0) + 1

    # Second, tree-relative check: a glob can be narrower than the probes above
    # and still swallow this particular repo (`**/*.ts` in a TypeScript project).
    if total and len(parts) > 1:
        # Dominance is necessary but NOT sufficient: `backend: src/**` owning
        # 96/100 files in a backend-heavy monorepo is correct partitioning, not a
        # catch-all. Require the glob to ALSO be unanchored — no literal path
        # segment before the first wildcard — so a directory-scoped glob is never
        # flagged no matter how much of the tree it happens to own.
        unanchored = {}
        for p in parts:
            for g in (p.get("paths_included") or []):
                head = _strip_dot_prefix(str(g).strip()).split("*")[0].strip("/")
                if not head:
                    unanchored.setdefault(p.get("id", "?"), g)
        for pid, count in per_partition.items():
            if (count >= total * 0.95 and pid in unanchored
                    and not any(c[0] == pid for c in catch_alls)):
                catch_alls.append(
                    (pid, f"{unanchored[pid]} <unanchored, matches {count}/{total} files>"))

    depth = {p.get("id"): p.get("depth", "unknown") for p in parts}
    risk = {p.get("id"): (p.get("risk") or {}).get("score") for p in parts}
    cut = [{"partition": pid, "risk_score": risk.get(pid),
            "source_files": per_partition.get(pid, 0)}
           for pid, d in depth.items() if d == "inventory-only"]
    cut.sort(key=lambda x: -(x["source_files"] or 0))

    result = {
        "source_files_considered": total,
        "unmatched_count": len(unmatched),
        "unmatched": unmatched[:500],
        "multi_matched_count": len(multi),
        "multi_matched": multi[:200],
        "catch_all_partitions": [{"partition": pid, "glob": g}
                                 for pid, g in catch_alls],
        "files_per_partition": per_partition,
        "deep_dive_cut_line": cut,
    }

    if not args.quiet:
        print(f"partition coverage: {total} source file(s) considered across "
              f"{len(parts)} partition(s)")
        if catch_alls and len(parts) > 1:
            print("\nCATCH-ALL PARTITIONS (a bare glob next to specific partitions "
                  "turns 'unmatched' into 'silently swallowed'):")
            for pid, g in catch_alls:
                print(f"  ! {pid}: {g}")
        if multi:
            print(f"\n{len(multi)} file(s) match more than one partition "
                  "(workflow.md §1.6: highest-risk partition wins downstream):")
            for m in multi[:args.max_report]:
                print(f"  ~ {m['file']} -> {', '.join(m['partitions'])}")
            if len(multi) > args.max_report:
                print(f"  ... and {len(multi) - args.max_report} more.")
        if cut:
            print("\nDEEP-DIVE CUT LINE — inventory-only partitions (enumerated in "
                  "Phase 2, NOT deep-dived in Phase 5). Raise top_n or promote on "
                  "surface evidence (Phase 2 §2.13) if any of these hold handlers:")
            for c in cut[:args.max_report]:
                print(f"  - {c['partition']:<32} risk={c['risk_score']} "
                      f"files={c['source_files']}")
        if unmatched:
            print(f"\nUNMATCHED — {len(unmatched)} source file(s) belong to NO "
                  "partition. Phase 1 FAILS: an unpartitioned handler never gets a "
                  "deep dive, and nothing downstream will say so.")
            for u in unmatched[:args.max_report]:
                print(f"  ! {u}")
            if len(unmatched) > args.max_report:
                print(f"  ... and {len(unmatched) - args.max_report} more.")
        else:
            print("\nEvery source file maps to at least one partition.")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
        if not args.quiet:
            print(f"\nwrote coverage report -> {args.out}")

    # A catch-all glob alongside specific partitions makes EVERY file "matched",
    # so `unmatched` stays empty and the gate returns 0 — in exactly the case its
    # own docstring says it exists to prevent. Reporting it while passing the run
    # is theatre: the prose in phase-01 §1.6b says "do not paper over it with a
    # catch-all", and until this check existed nothing enforced that.
    # A single-partition repo (the documented `kind: repo` fallback) legitimately
    # owns everything, so the check only fires when other partitions exist.
    if catch_alls and len(parts) > 1:
        if not args.quiet:
            print(f"\n{'WARN' if args.allow_catch_all else 'FAIL'}: a catch-all "
                  f"glob sits alongside {len(parts) - 1} specific partition(s). "
                  "It matches every file, so this gate reports full coverage no "
                  "matter what was omitted. Give the swallowed paths their own "
                  "partition and their own risk score."
                  + (" Accepted because --allow-catch-all was passed; coverage "
                     "below is therefore not evidence of anything."
                     if args.allow_catch_all else
                     " Pass --allow-catch-all only if the partition genuinely "
                     "owns the whole tree."))
        result["catch_all_accepted"] = bool(args.allow_catch_all)
        if not args.allow_catch_all:
            return 1

    if unmatched or (args.fail_on_multi and multi):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
