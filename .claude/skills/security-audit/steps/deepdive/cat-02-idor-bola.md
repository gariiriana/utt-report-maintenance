# Deep Dive #2 — IDOR / BOLA

**Category.** `idor`.

**OWASP tags.**
- ASVS: V4.2.1 (Access control rules enforced by server), V4.3.2
  (Directory browsing disabled except where intentional).
- API Top 10: `API1:2023` (BOLA — Broken Object Level Authorization),
  `API3:2023` (BOPLA — Broken Object Property Level Authorization).

**Baseline CWEs:** 284, 285, 639, 862, 915.

> **Cross-cutting lens — apply it here.**
> [`lens-availability-integrity.md`](lens-availability-integrity.md). This
> file is confidentiality-oriented: *can I read someone else's object?* The
> lens covers the path with no confidentiality component at all — a principal
> who creates enough of their **own** objects to displace everyone else's from
> a downstream fixed-size scan. Nothing is disclosed and nothing errors. File
> its findings under `idor`.

---

## Invariants to verify

1. Every parameterized route whose handler accesses an entity with an
   ownership column (from `profile.data_model.entities[*].owner_cols`)
   scopes the query by the authenticated user / tenant / organization.
2. List endpoints filter the result set by the authenticated scope
   (no "return all rows" for a per-user resource).
3. Nested resource access (`/parents/:pid/children/:cid`) verifies the
   child belongs to the parent AND the parent belongs to the user.
4. GraphQL resolvers apply the same scoping at the field level
   (`@Resolver` class / field resolver).
5. Bulk endpoints (`/bulk-delete`, `/batch-update`) verify every id in the
   batch.
6. Search endpoints filter results by the caller's access.
7. File-download endpoints verify the caller can read the referenced
   resource (not just that they can authenticate).
8. Property-level: update endpoints don't allow mass-assigning
   `role`, `isAdmin`, `permissions`, `orgId`, etc. (See also cat-01
   §"Mass assignment".)

## Data-flow / taint trace (do this before asserting an IDOR)

CyberGym-E2E's #1 analysis failure is incomplete data-flow tracing
(basis: `docs/research/08-cybergym-e2e.md`). IDOR is a taint bug: the
object id is the user-controlled source and the entity query is the sink.
Before flagging, trace the **source -> sink** path — from where the id
enters (path / query / body param) to the query that uses it — across
files if the route, handler, and data-access layer are separate. Confirm
the id reaches the query with no ownership / tenant / org scope applied
anywhere on that path.

Calibrate confidence to trace completeness:
- `LIKELY` when the full source->sink path is established by this trace
  alone (the user-controlled id is shown reaching an unscoped query).
  Promote to `CONFIRMED` only when a second source (e.g. a scanner)
  independently agrees — per the Phase-7 §7.3 rubric a single manual trace
  is `LIKELY`, not `CONFIRMED`.
- `POSSIBLE` when an unscoped sink is found but the taint / source cannot
  be confirmed from the read region (e.g. the id's origin or a scoping
  middleware lies outside the handler ± ~40 lines you read).

## Candidate surfaces

From `phase-02-surface.json`, filter to surfaces where:
- `category == http` or `graphql` or `trpc`, AND
- Any `param.source == "path"` OR `param.source == "query"` with a name
  matching `^(id|[a-z]+Id|[a-z]+_id)$`, AND
- The handler reads an ownership-columned entity.

Every candidate must be verified — do not sample.

> ⚠ **Scope boundary (v2.5 — read this).** The id-param requirement above makes
> this lens **object**-centric, and that is deliberate. It also means a
> collection route (`GET /resources`, no id param at all) **never becomes a
> candidate here** — which is precisely how an unscoped list endpoint passed a
> full v2.4 audit while invariant #2 above sat unreachable on the page.
>
> Collection endpoints are covered by **[cat-12 Collection
> Scoping](cat-12-collection-scoping.md)**, which takes the complementary filter
> (`data_ops` contains `read` AND the handler runs a list-shaped query, **no id
> param required**). If your partition has list endpoints and cat-12 did not run,
> say so in your notes rather than silently leaving them unaudited — and cover
> them here.

## Detection patterns

### Query without ownership filter

Read the handler ± ~40 lines (not the whole file). Look for database
queries against an owned entity where the `WHERE` clause references
**only** the ID param, not the user / tenant / org scope.

Examples of the **vulnerable** pattern:

```typescript
// Drizzle — missing ownership filter
const item = await db.query.items.findFirst({
  where: eq(items.id, params.id)
});
```
→ **HIGH** if sensitivity ≥2, else MEDIUM / CWE-639.

```python
# Django — using all() without user filter
item = Item.objects.get(pk=pk)
```
→ **HIGH** / CWE-639.

```ruby
# Rails
@item = Item.find(params[:id])
```
→ **HIGH** / CWE-639. The safe pattern is `@item = current_user.items.find(params[:id])`.

### Ownership check after fetch (timing-leak)

```typescript
const item = await db.query.items.findFirst({ where: eq(items.id, id) });
if (item.userId !== session.userId) throw createError({ statusCode: 403 });
```

Better than no check, but the 403 vs 404 distinction leaks existence. Flag
as **MEDIUM** / CWE-209 (information exposure through error message).
Suggest: return 404 uniformly for "not found" and "forbidden" on IDOR
surfaces.

### Nested resource access

For surfaces with `path` matching `:parentId.*:childId` or similar, read
the handler ± ~40 lines: does the query chain through parent ownership?

Safe: `parent.children.find(childId)` where `parent` was fetched via an
ownership-filtered query.

Vulnerable: direct lookup of child by id without verifying parent
ownership. → **HIGH** / CWE-639.

### Search / list endpoints

Handler calls `.findAll()` / `.all()` / `.list()` without a user scope.
Flag → **HIGH** / CWE-284. Suggest: `.where(userId = currentUser.id)`.

Note that a `WHERE` clause being **present** proves nothing: `scope = 'user'` and
`deletedAt IS NULL` constrain *which* rows, not *whose*. The test is whether any
predicate references a caller-derived value. Full treatment — including the
authorization-by-decoration antipattern and the "a test pins the bug" signal —
is in [cat-12](cat-12-collection-scoping.md); flag it here too if cat-12 is not
running for this partition.

### GraphQL resolvers

For each `@Resolver` class method matching the BOLA surface criteria,
verify the resolver reads ownership. Graphql-armor / authz-middleware
presence helps but is not sufficient — the resolver body must still
scope.

### Bulk endpoints

Handler iterates over `req.body.ids` / similar. Each id must be scoped
to the caller; a single missed id equals a full IDOR. Flag any bulk
handler that passes the raw id list into `.destroyAll({where: {id: {in:
ids}}})` without an ownership filter.

### Property-level (BOPLA)

Grep patterns:
- JS/TS: `Object.assign(existing, req.body)` on user-profile update;
  `.update(req.body)` without a `fields:` whitelist.
- Rails: `@user.update(params[:user])` without `permit(:name, :email, ...)`.
- Django: serializer with no `fields` / `read_only_fields`.

Flag → **HIGH** / CWE-915.

### Predictable IDs (enumeration)

If the entity uses sequential integer ids and the endpoint allows
authenticated enumeration (the error message differs between "forbidden"
and "not found"), flag as **MEDIUM** / CWE-200.

### Capability-URL / cross-surface identifier flow (distinct from classic IDOR)

Classic IDOR is a *missing ownership scope on an authenticated request*. The
**capability-URL** cousin is different and easy to miss: access is
**unauthenticated**, gated only by knowledge of a hard-to-guess identifier
(UUID/slug/short-id), where that identifier is **handed to clients** (rendered in
the DOM, returned in an API response, used as an iframe `src`, leaked via
`Referer`/logs). The control collapses to id-secrecy, which is not secret.

Trace the identifier **across surfaces**: it is often *issued* by one endpoint (a
resolver that gates on 2FA/login) and *consumed* by another (a content endpoint
that re-derives authority from possession of the id alone). The cross-surface hop
is the vuln, and it spans files/partitions — so a single-handler ±40-line read
cannot see it. Flag the consuming endpoint → **HIGH/CRITICAL** / **CWE-639**
(user-controlled key) or **CWE-441** (confused deputy) and set
`related_partitions[]`. The authoritative cross-surface check is the Phase 6
§6.19 Authorized-Egress reconciliation; cat-02 feeds it the per-handler trace.

## False-positive notes

- **Public resources.** Products, categories, blog posts — shared-read
  resources with no ownership column. Verify `profile.data_model.entities[].owner_cols` is empty for these entities before flagging.
- **Admin-only endpoints** that legitimately return everything. Cross-
  reference with `roles_required == ['admin']` on the surface row.
- **Soft-deleted rows.** `where: and(eq(id, ...), isNull(deletedAt))` is
  a valid non-ownership filter; not an IDOR gap on its own.

## Output

Write JSONL to `phase-05-idor-<partition_id>.jsonl`, marker
`phase-05-idor-<partition_id>.done`. Include `surface_id` on every
finding so Phase 7 can cross-link.
