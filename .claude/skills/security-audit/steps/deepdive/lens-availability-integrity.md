# Lens — Availability / integrity attack paths with no confidentiality component

**This is a lens, not a category.** It has no fan-out of its own. It is applied
inside `cat-01` (auth/authz), `cat-02` (IDOR/BOLA), `cat-08` (injection/SSRF)
and `cat-12` (collection scoping), each of which carries a pointer here. Its
findings are filed under **the host category's** `category` value.

**OWASP tags.** ASVS V1.5.4 / V11.1 (business-logic limits, anti-automation),
`API4:2023` (unrestricted resource consumption), `API6:2023` (unrestricted
access to sensitive business flows).

**Baseline CWEs:** 770 (allocation of resources without limits — the primary),
400 (uncontrolled resource consumption).

---

## Why this lens exists (read this before the rules)

Every category in the catalogue is oriented toward **confidentiality** — who
can read what. The severity arithmetic inherits that orientation: crown jewels
are `reads:*` and `escalates:admin`, personas are defined by what they can
*see*. A whole class of attack path has no confidentiality component at all,
discloses nothing, raises no error, and therefore matches nothing.

The calibrated run missed a HIGH of exactly this shape:

> An **uncapped provisioning call** lets a *developer* — an already-trusted,
> already-authenticated principal — mint more than 500 empty instances. A
> downstream reconciliation performs a **fixed-size 500-row scan**. The 500
> empty instances displace every real one from that window. The result is an
> estate-wide **silent attribution stop**: nothing is disclosed, nothing
> errors, no alert fires, and the data simply stops being correct.

Three properties make this invisible to the rest of the catalogue, and each is
a rule below:

1. **The attacker is authorised.** The provisioning call is one the principal
   is *supposed* to be able to make. There is no missing gate to find, so the
   auth lens does not fire. What is missing is a **bound**.
2. **The damage lands somewhere else.** The defective call site and the
   damaged behaviour are in different files, often different services, and the
   link between them is a constant (`LIMIT 500`) that reads as an
   implementation detail rather than a security boundary.
3. **The failure is silent by construction.** A resource-exhaustion bug that
   throws is an incident someone investigates. One that quietly truncates is a
   correctness regression nobody attributes to an attacker.

## Invariants to verify

For every **write path that creates rows, files, jobs, tenants, instances,
tokens or queue entries** on behalf of a caller, assert **at least one** of:

1. a **per-principal cap** on the count created (quota, plan limit, row-count
   check before insert); **or**
2. a **rate/anti-automation control** that bounds creations per unit time; **or**
3. the created object is **not read by any bounded downstream consumer** — no
   `LIMIT`, no fixed page, no fixed-size batch, no first-N scan, no
   priority-ordered queue drain that can starve; **or**
4. the downstream consumer is bounded but **orders by a key the caller cannot
   influence** and processes to completion across pages.

Otherwise → finding.

## Detection patterns

### 1. Uncapped creation reachable by a non-admin principal

Grep the surface inventory for `data_ops` containing `write` on entities whose
rows are later scanned. In the handler, look for an `INSERT`/`create`/`save`
with **no preceding count check** against a limit:

```typescript
// Vulnerable — nothing bounds how many of these a caller may create
await db.insert(instances).values({ ownerId: session.user.id, ...input })
```
```python
Instance.objects.create(owner=request.user, **payload)   # no quota check
```

Look specifically for the **absence** of: `count(`, `.length >=`, `quota`,
`limit`, `max_`, `plan.`, `usage`, `rateLimit`, `throttle` on the path.

→ On its own this is **MEDIUM** / `CWE-770`. It becomes HIGH+ only when
rule 2 pairs it with a bounded consumer — file both and let the composer do
the arithmetic; do not assert the composed severity yourself.

### 2. A bounded downstream consumer (this is the half everyone misses)

This is a **grep, and it is the one that turns a MEDIUM into a real finding.**
Sweep the repository for fixed bounds over the same entity:

- SQL / ORM: `LIMIT <n>`, `.limit(<n>)`, `.take(<n>)`, `TOP <n>`, `FETCH FIRST`
- Batch loops: `slice(0, <n>)`, `[:n]`, `chunk(<n>)`, `batchSize`, `maxResults`
- APIs: `MaxKeys`, `PageSize`, `maxRecords`, `per_page` with no pagination loop
- Config constants: `MAX_*`, `*_LIMIT`, `*_BATCH`, `PAGE_SIZE`

For each hit, ask the two questions that matter:

- **Is the ordering attacker-influenceable?** `ORDER BY created_at DESC` with
  attacker-created rows is displacement. `ORDER BY id` over a keyset the caller
  cannot occupy is not.
- **Does the loop terminate on the bound, or paginate past it?** A single
  bounded read is displacement. A cursor loop that drains everything is not.

A bounded consumer over an entity anyone can create rows in is a finding even
when the creation path is capped — the cap is a mitigation, not a fix, and it
belongs in `preconditions`.

### 3. Silent truncation vs. loud failure

Establish which one this is, and say so in the description. It changes the
severity and it changes who will ever notice:

| Behaviour | Rating |
|---|---|
| Consumer truncates and returns success | the full finding — nothing detects it |
| Consumer throws / alerts / emits a metric | one rung lower — it is an incident, not a silent stop |
| Consumer retries unboundedly | a separate availability finding; tag `denies:` |

**Grep for the absence of the alarm**: no `logger.warn` / no metric increment /
no `if (rows.length === LIMIT)` guard on the truncation branch. Code that
checks whether it hit its own bound is code that knows the bound is a
boundary.

### 4. Priority / ordering starvation

A fixed-size worker pool, a queue drained in priority order, or a
`ORDER BY priority` scan lets a caller who can create high-priority items
starve everyone else's. Same shape, no row bound required.

### 5. Integrity variant — the record completes, but wrong

Where §3's consumer *writes* a derived record (an attribution table, a billing
roll-up, a reconciliation ledger, a compliance export), truncation does not
just delay work — it produces a **wrong record that downstream systems trust**.
Rate this above the availability variant and tag `corrupts:`, not `denies:`.

## Data-flow discipline (do this before asserting)

The trace is **producer → store → bounded consumer**, and both ends are needed.
A finding filed on only one end is not this class:

1. Locate the creation site and establish who can reach it and with what
   preconditions. "Only a developer can" is a *precondition*, not a defence —
   write it as one.
2. Establish that the created rows land in a store a bounded consumer reads.
   Name the store.
3. Locate the bound. Cite it at `file:line` with the literal constant.
4. Establish the ordering and whether the caller can occupy the window.
5. Establish what the consumer does on truncation (§3).

Only then rate. Confidence maps to how much of that chain you closed:
`LIKELY` when all five are established in code; `POSSIBLE` when the bound is
found but the ordering could not be shown attacker-influenceable.

## False-positive notes

- **Bounds with pagination.** A `LIMIT 500` inside a cursor loop that runs to
  exhaustion is correct engineering, not a boundary. Read the loop.
- **Caps that exist elsewhere.** A quota enforced in a middleware, a database
  `CHECK`, a plan limit in a billing service, or a unique constraint that
  bounds rows per principal by construction. Find it before filing — and
  record it as `scope_evidence`-style `file:line` in the description.
- **Genuinely unbounded-by-design stores.** Append-only logs, event streams and
  audit tables are supposed to grow. The question is never "can this grow" but
  "does something read it with a fixed window it can be pushed out of".
- **Admin-only creation.** If the creation path is genuinely restricted to an
  admin-tier role, this is an insider-risk note, not a finding — but check
  `capability_lexicon.personas` first. An SSO flow that auto-provisions a role
  on first login makes that role externally obtainable, and "developer" is
  almost never an admin tier.

## Capability tagging

Per [`../../lib/capability-lexicon.md`](../../lib/capability-lexicon.md), this
lens is the reason the lexicon carries `denies` and `corrupts`. Without them
the chain has no vocabulary and composes to nothing.

The two halves tag like this:

```jsonc
// The uncapped creation site
"preconditions":  ["authenticated"],
"postconditions": ["writes:any_instance"]

// The bounded consumer
"preconditions":  ["writes:any_instance"],
"postconditions": ["denies:any_attribution_processing",
                   "corrupts:any_attribution_record"]
```

`writes:any_<e>` is the join. Tag it on the creation finding even when that
finding alone rates MEDIUM — it is the capability the consumer finding needs,
and an untagged creation site makes the composed path invisible, which is
exactly how this class went unfiled.

Then check `capability_lexicon.crown_jewels` (Phase 0 §0.14): if the damaged
record is a system of record for an estate-wide process, `denies:` /
`corrupts:` on it should be a crown jewel, and rule R3 will rate the composed
path without anyone having to argue for it.

## Output

Findings are filed under the **host category** (`auth`, `idor`, `injection` or
`collection_scope` as appropriate) into that category's JSONL — there is no
`phase-05-availability-*.jsonl`. Say in `notes` that the finding came from this
lens so the next calibration can measure it separately.

The sibling sweep (`phase-05-deepdives.md §5.9`) applies here as everywhere,
and it is unusually productive on this class: a fixed bound is a constant, and
constants travel in packs.
