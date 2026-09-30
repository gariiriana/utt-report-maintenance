# Deep Dive #12 — Collection Scoping (BOLA at the list level)

**Category.** `collection_scope`.

**OWASP tags.**
- ASVS: V4.2.1 (access-control rules enforced by the server), V8.1.1 (sensitive
  data is not returned to unauthorised principals).
- API Top 10: `API1:2023` (BOLA) at the **collection** level, `API3:2023`
  (BOPLA / excessive data exposure).
- Web Top 10: `A01:2025` (Broken Access Control).

**Baseline CWEs:** 1220 (insufficient granularity of access control — the
primary), 863, 284, 359, 200.

> **Cross-cutting lens — apply it here.**
> [`lens-availability-integrity.md`](lens-availability-integrity.md). You are
> already reading every list query in the partition, which makes you the one
> agent positioned to spot the **bounded consumer** half of the chain: a fixed
> `LIMIT`/`take`/`slice` over an entity anyone can create rows in, ordered by a
> key the caller can occupy. Asking *whose rows are these* and asking *which
> rows fell out of the window* are the same read of the same query. File its
> findings under `collection_scope`.

---

## Why this category exists (read this before the rules)

cat-02 (IDOR/BOLA) is **object**-centric: `/resource/{id}` — *can I read someone
else's object?* Its candidate filter requires an id-shaped path or query param.
A collection route `/resources` has no id param, so under v2.4 it **never became
a candidate at all** — and cat-02's own invariant "list endpoints filter the
result set by the authenticated scope" was therefore unreachable in practice.

This category is **collection**-centric: `/resources` — *does the list constrain
rows to me?*

The shape that got through a full audit with all six scanners present, no
degraded mode, and a clean bill:

```ts
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'reader')            // :290  the gate EXISTS
  ...
  .where(and(eq(decks.scope, 'user'), isNull(decks.deletedAt))) // :231  no owner predicate
  ...
  const tree = applyCanWrite(rawTree, session)                  // :350  decorates, never filters
  return { data: tree }
})
```

Every authenticated user received a browsable directory of **every** other
user's private resources: full UUID, title, description, size, owner roster.
Chained with a sibling endpoint that admits any known id, it yielded the full
document contents of other people's private data.

Three things make this hard for a conventional lens, and each is a rule below:

1. **The gate is present, unambiguous, and correct-looking.** Conservative,
   negation-aware auth ranking does not fire — it fires on *absent* or
   *ambiguous* gates. The defect is that **authentication was used where per-row
   authorization was required**.
2. **The `WHERE` clause is not empty.** `scope = 'user'` and `deletedAt IS NULL`
   are predicates — they constrain *which* rows, not *whose*. A "has a WHERE
   clause" check passes.
3. **A permission is computed per row and attached rather than applied.**
   `applyCanWrite` returns `{...node, canWrite: false}` for rows the caller may
   not even see.

## Invariants to verify

For **every** handler returning a list, tree, or aggregate of an entity that is
not on `profile.public_resources` (default-deny, §0.12b), assert **at least
one** of:

1. a `WHERE`/filter predicate **binds to caller identity** — session user id,
   email, org id, tenant id, workspace id, or a membership join; **or**
2. a per-row visibility helper is invoked **and its result is used to FILTER**
   the collection (not to decorate it); **or**
3. the entity is on the `public_resources` allowlist; **or**
4. the endpoint is restricted to an **admin-tier** role that legitimately sees
   every row (cross-check `roles_required`, not the handler's prose).

Otherwise → finding.

## Candidate surfaces — deliberately NOT the cat-02 filter

From `phase-02-surface.json`, take every surface where:
- `category ∈ {http, graphql, trpc, grpc, sse, websocket}`, **and**
- `data_ops` contains `read`, **and**
- the handler executes a **list-shaped query**.

**Do NOT require an id-shaped parameter.** That requirement is precisely the bug
this category exists to fix — a collection endpoint has no id param, which is
what made it invisible. A surface with *zero* params is a first-class candidate
here.

Enumerate exhaustively; do not sample. Every candidate becomes either a
`collections[]` row or a `dismissed[]` row with a reason in
`phase-02-collections.json` (§2.12) — the fail-closed coverage gate re-derives
the candidate set from source and fails the run on any silent omission.

## Detection patterns

### 1. Unscoped list query (the primary rule → C1)

Read the handler **and follow the query to where it is built**, including
repository/service layers in other files. Extract every predicate. Ask: does
**any** predicate reference a value derived from the caller?

Caller-derived tokens: `session.*`, `current_user`, `req.user`, `ctx.user`,
`principal`, `claims`, `viewer`, `userId`, `ownerId`, `createdBy`, `tenantId`,
`orgId`, `organizationId`, `accountId`, `workspaceId`, a membership/ACL join.

**Vulnerable — a WHERE clause that constrains *which*, not *whose*:**

```typescript
// Drizzle
.where(and(eq(decks.scope, 'user'), isNull(decks.deletedAt)))     // literals only
```
```python
# Django — filter present, caller absent
Deck.objects.filter(scope="user", deleted_at__isnull=True)
```
```ruby
Deck.where(scope: "user")
```
```php
Deck::where('scope', 'user')->get();
```
→ **HIGH** / `CWE-1220` / `API1:2023` / `A01:2025` when the entity has
`owner_cols` or `pii_cols`; **MEDIUM** otherwise. Use `CWE-359` instead of
`CWE-1220` when the rows returned include PII columns.

**Safe:**
```typescript
.where(and(eq(decks.ownerId, session.user.id), isNull(decks.deletedAt)))
```

### 2. Authorization by decoration (→ C2)

A function that computes a permission **per row** and attaches it to the
response instead of using it to filter.

Detect: a `.map()` / list comprehension / `select` that adds a permission-shaped
boolean (`can*`, `is*Allowed`, `*Permitted`, `readOnly`) with **no `.filter()`
on the same collection**.

```typescript
const tree = rawTree.map(n => ({ ...n, canWrite: userCanWrite(n, session) }))
return { data: tree }          // never filtered
```
→ **HIGH** / `CWE-863` / `A01:2025` when the collection was never read-filtered.
Treat *write*-permission decoration on a collection that was never *read*-
filtered as a finding **by construction** — the write decision proves the code
knows who the caller is, and chose not to apply that knowledge to reads.

### 3. Nested / tree responses hide the rows (→ C1, `returns: "tree"`)

A tree or grouped response is the easiest place for cross-principal rows to
hide, because the top level looks like the caller's own data and the foreign
rows sit in child nodes. When the response is nested, verify scoping at **every
level of the projection**, not just the root query.

### 4. Aggregates leak too

`COUNT`, `SUM`, `GROUP BY`, faceted search counts, and "N others" badges
computed over an unscoped set disclose the existence and volume of other
principals' rows. Record `returns: "aggregate"`; rate one rung below the
equivalent row disclosure unless the aggregate is per-entity (which is an
oracle).

### 5. A test that pins the bug (→ C4)

Grep the handler's sibling test files for an assertion that another principal's
resource **is present** — rather than absent or 404 — especially alongside a
permission-shaped field asserted false:

```typescript
expect(tree.children).toContainEqual(
  expect.objectContaining({ name: "other-user-folder", canWrite: false })  // pins the bug
)
```

This is high-signal precisely because someone wrote it deliberately: the
insecure behaviour is encoded as the expected behaviour, so a correct fix will
look like a broken test. → **MEDIUM**, confidence `POSSIBLE`, and say plainly in
the description that the fix must invert the assertion.

### 6. A scoping claim with no caller-derived predicate (→ C5)

If your own inventory row says `row_scope: "caller_bound"`, the
`scope_evidence.predicate` must contain a caller-derived token. If it does not,
you are recording a filter on a literal as if it were authorization. The
deterministic reconciliation re-checks this and rewrites the row to `unscoped` —
so claiming scoping you cannot evidence buys nothing.

## Data-flow discipline (do this before asserting)

This is a **projection** bug, not a taint bug: there is no attacker-controlled
source to trace. The trace runs the other way — from the **query** to the
**response**:

1. Locate the query construction (may be several files away — repository,
   service, or a shared `buildXQuery()` helper).
2. Collect every predicate applied on that path, including ones added by
   middleware, a base scope/`default_scope`, a Drizzle `.$dynamic()` chain,
   Django manager overrides, ActiveRecord `default_scope`, or a Prisma extension.
   **A scope applied in a base class or manager IS valid scoping** — find it
   before flagging.
3. Follow the result through every `map`/`filter`/serializer to the response.
4. Only then rate.

Calibrate confidence to trace completeness:
- `LIKELY` — the full query→response path is established and no caller-derived
  predicate exists anywhere on it.
- `POSSIBLE` — the query is unscoped in the read region but a base scope or
  manager override could not be ruled out. Record `row_scope: "unknown"` and let
  the reconciliation rate it one rung lower.
- `CONFIRMED` — only when a second source agrees (a scanner rule, or the
  deterministic reconciliation's own C1/C5 finding for the same handler).

## False-positive notes

- **Genuinely public resources.** Product catalogues, blog posts, published
  documentation. Verify against `profile.public_resources` (§0.12b) — and note
  that the allowlist is surfaced in the report for human review, so adding to it
  is an auditable decision rather than a silent dismissal.
- **Admin endpoints that legitimately return everything.** Cross-check
  `roles_required` contains an admin-tier role. `reader`, `member`, `user`,
  `contributor` are **not** admin-tier — and an SSO flow that auto-provisions a
  role on first login makes that role externally obtainable.
- **Base scopes.** `default_scope`, a repository that always injects the tenant,
  a Prisma client extension, or row-level security in the database. All are
  valid scoping — record them as `scope_evidence` with the file:line where the
  scope is applied.
- **Soft-delete and status filters** (`deletedAt IS NULL`, `status = 'active'`)
  are **not** scoping. Neither is `scope = 'user'`. They constrain which rows
  exist, not whose they are.
- **Self-collections.** `/me/resources` where the id comes from the session is
  caller-bound by construction — record the session-derived predicate as
  evidence.

## Capability tagging (MANDATORY for this category)

Per [`../../lib/capability-lexicon.md`](../../lib/capability-lexicon.md), every
finding here MUST carry `preconditions` and a non-empty `postconditions`:

```jsonc
"preconditions":  ["authenticated", "role:reader"],   // [] if anonymous-reachable
"postconditions": ["knows:any_deck_id", "reads:any_deck_metadata"]
```

`knows:` is the one that matters. An unscoped list endpoint is the **enumeration
half** of a chain: it supplies exactly the capability that a sibling finding's
"only exploitable if the attacker knows the UUID" mitigation assumes nobody has.
Tag it, and rule R1 will refuse to let that mitigation lower the sibling's
severity.

## Output

Write JSONL to `phase-05-collection_scope-<partition_id>.jsonl`, marker
`phase-05-collection_scope-<partition_id>.done`. Include `surface_id` on every
finding so Phase 7 can cross-link, and populate the
`phase-02-collections.json` row for each candidate you inspected — the Phase 6
§6.20 reconciliation reads that inventory and will fail the run on any candidate
you neither inventoried nor dismissed.
