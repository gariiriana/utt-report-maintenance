# Phase 2 — Attack Surface Inventory

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-02-surface.json` (one row per attack-surface item: route, handler file+line, method, auth status, trust zone)
- `.claude-audit/current/phase-02-sinks.json` (egress-sink inventory — §2.11; ALWAYS written, empty `sinks: []` if none)
- `.claude-audit/current/phase-02-credentials.json` (credential mint/consume ledger — §2.11; ALWAYS written, empty `credentials: []` if none)
- `.claude-audit/current/phase-02-collections.json` (collection row-scoping inventory — §2.12; ALWAYS written, empty `collections: []` if none)
- `.claude-audit/current/phase-02.done`

⛔ **DO NOT advance to Phase 3** until all four artifacts exist AND the Verify block at the bottom prints `phase-02 verified`.

📖 Phase 5's auth + IDOR categories and Phase 6's API Top 10 mapping both read `phase-02-surface.json`. A skipped surface row is a missed auth check.

---

**Goal.** Enumerate **every** entry point to the application. Not just HTTP
routes — gRPC methods, GraphQL resolvers, queue consumers, schedulers,
webhooks, file uploads, serverless handlers, mobile / desktop IPC,
admin/debug endpoints, CLI/admin scripts, and outbound TLS clients. This is
the ground truth that Phases 3-7 cross-reference.

**Inputs.**
- `.claude-audit/current/phase-00-profile.json`
- `.claude-audit/current/partitions.json`
- `.claude-audit/ignore.txt`

**Output.** `.claude-audit/current/phase-02-surface.json` conforming to
`lib/surface-schema.json`, plus the saga marker `phase-02.done`.

**Execution model.** One sub-agent **per partition** using the shared
template at `templates/subagent-prompt.md`. The orchestrator caps
concurrency at 8 in-flight sub-agents. Inventory-only partitions still get
enumerated (Phase 5 will skip them, but Phase 2 runs for all).

**Principle.** Do **not** sample. Enumerate exhaustively. A missed surface
is a missed finding in every downstream phase.

---

## 2.1 — Per-Partition Sub-Agent

Invoke with the template. Fill `{{extra-inputs}}` to empty. Fill
`{{phase-specific-method-body}}` with the body of §2.2-2.5 below.

Return shape (per template): the count of surfaces written, the by-category
breakdown, and the artifact path.

## 2.2 — Detect frameworks in scope

Read the partition's `frameworks[]` from `partitions.json` and cross-
reference `lib/surface-detection.md`. Every framework entry maps to a
detection recipe (glob + grep pattern + extractor). Run only the recipes for
frameworks that appear in this partition; skip the rest.

## 2.3 — Enumerate each surface category

For **every** surface category in the table below, run the detection and
emit one surface row per entry point. Categories with no hits emit nothing
(do not emit a "category empty" placeholder).

| Category | Detection (in `lib/surface-detection.md`) |
|---|---|
| `http` | per-framework handler registration or file-based routing |
| `grpc` | `.proto` methods paired with server-side `BindService`/`RegisterService` |
| `graphql` | resolvers, `@Resolver`, `buildSchema`, `typeDefs` |
| `websocket` | `@WebSocketGateway`, `ws.Server`, `socket.io`, `ActionCable::Channel`, Phoenix `Channel` |
| `sse` | `Content-Type: text/event-stream` set; `EventSource` server endpoints |
| `trpc` | `router.query` / `router.mutation` / `initTRPC` |
| `queue_consumer` | `@KafkaListener`, `@RabbitListener`, `@SqsListener`, `Consumer`, `BullMQ.Worker`, `Sidekiq.Worker.perform`, `Celery @app.task` |
| `scheduler` | cron decorators, `@Scheduled`, `sidekiq-cron`, `BullMQ repeat`, `celery beat`, `Hangfire.RecurringJob`, `systemd timer` units, `crontab`, `schedule` modules |
| `webhook` | inbound POST handlers with signature-header processing (`X-Hub-Signature`, `Stripe-Signature`, etc.) |
| `file_upload` | `multipart/form-data` occurrence + framework upload primitive (`@UploadedFile`, `multer.single`, `ActiveStorage`) |
| `serverless` | handler signatures (`exports.handler`, `func.main`) paired with platform templates (`template.yaml`, `function.json`, `wrangler.jsonc`, `serverless.yml`) |
| `mobile_ipc` | Android `AndroidManifest.xml` with `exported="true"`, iOS URL schemes, deep links |
| `desktop_ipc` | `ipcMain.handle`/`ipcMain.on`, `#[tauri::command]`, Electron preload bridges |
| `admin_debug` | `/actuator/*`, `/debug/pprof`, `/__debug__`, framework admin consoles |
| `cli_admin` | `bin/*`, `lib/tasks/*.rake`, `app/Console/Commands/*`, `manage.py` subcommands, `rake`, `artisan`, `mix` tasks |
| `outbound_tls` | HTTP client imports (`fetch`, `axios`, `requests`, `reqwest`, `okhttp`, `HttpClient`, `net/http.DefaultClient`) — collected only so Phase 5 category 4 (MITM) can audit them |

## 2.4 — Per-entry required fields

Every surface row in `surfaces[]` MUST include:

| Field | Meaning |
|---|---|
| `id` | unique within the audit; format `<partition-id>:<category>:<idx>` (e.g., `juice-shop:http:0042`) |
| `partition` | partition id this surface belongs to |
| `category` | one of the categories in §2.3 |
| `layer` | (v2.6, strongly recommended) `http` \| `browser` \| `cli` \| `worker` \| `build` \| `ipc`. §6.19 computes the gate floor per `(resource, layer)`; without it a browser component and a cron worker are compared against each other's gates. See §2.11a. |
| `gate_rank_hint` | (v2.6, optional) `none` \| `authn` \| `authz` \| `verified` — the rank you actually read, overriding the keyword ranker. See §2.11a. |
| `method` | for http/grpc/graphql: method or verb; for others: `null` |
| `path` | the external identifier (URL path, queue name, gRPC service/method, cron cadence, topic name) |
| `registration_file` | file where the route is *registered* (e.g., `server.ts` for `app.post('/x', ...)`) |
| `handler_file` | file containing the handler function *body* (e.g., `routes/x.ts` for a modular Express route). For file-based routing, equals `registration_file`. |
| `line_range` | `[start_line, end_line]` of the handler body **in `handler_file`** |
| `handler_hash` | sha1 of the normalized handler body content **from `handler_file`** (see `lib/handler-hash.md`) |
| `auth_required` | `true` / `false` / `unknown` |
| `auth_middleware` | list of middleware / decorators applied (strings) |
| `roles_required` | list of role / scope strings asserted in the handler or middleware |
| `params` | list of `{name, source, sensitive}` where source ∈ `path|query|body|header|cookie` and sensitive is boolean |
| `trust_zone` | inherited from the partition by default; override if the surface is explicitly admin/internal |
| `data_ops` | list of data operations: `read|write|delete|exec|none` |
| `framework` | the framework that produced this surface (e.g., `Express`) |
| `serves_resource` | canonical `data_model` entity id this surface reads/emits, or `null` (v2.4 — join key for Authorized-Egress) |
| `intended_gate` | the strongest gate the served resource declares (RBAC / tenant-ownership / 2FA-share / OIDC), or `null` (v2.4) |
| `emits_bytes` | `true` if this surface itself returns the resource's bytes; `false` for resolve/identify surfaces that only hand out an id (v2.4) |
| `guarded_paths` | per-branch authz `[{branch_id, condition, enforced_gate, serves_bytes}]` — fill for any surface that serves a sensitive resource (v2.4) |
| `notes` | free text (≤200 chars), optional |

> **v2.4 — answer the real question per interface.** For every surface that can
> read or emit a resource, the question is NOT "is there an auth check?" but
> "what is the resource's *strongest intended gate*, and is it enforced on
> **every branch** that emits bytes?" Record `serves_resource` + `intended_gate`,
> and enumerate `guarded_paths` per branch. A handler with an authed branch AND
> a conditional unauthenticated bypass branch (the deck-2FA shape) MUST show both
> branches — recording only the authed one is the exact miss this release fixes.

## 2.5 — Handler body extraction & hashing

**Step 1 — Resolve `handler_file`.**

For each detected route registration (which gives you `registration_file`),
resolve the actual handler function's location:

- **Inline handler** — handler is an anonymous function / arrow function /
  lambda at the registration site. `handler_file == registration_file`.
- **Named local handler** — registration references a function defined in
  the same file (`app.post('/x', createX)` where `createX` is later in
  the file). `handler_file == registration_file`; line_range points at
  the function definition, not the registration.
- **Imported handler** — registration references an imported symbol
  (`app.post('/x', require('./routes/x').handler)` or
  `app.post('/x', handlers.createX)`). Follow the import:
  - Node `require('./routes/x')` → `routes/x.{js,ts,mjs,cjs}` — find
    the exported symbol or the module's default export's `.handler`
    property.
  - ES modules `import { createX } from './routes/x'` → same resolution.
  - Python `from .routes.x import handler` → `routes/x.py`, function
    `handler`.
  - Go `Mount("/x", routes.New())` — follow the struct method.
- **Class-based handler** — `@Controller`/`@RestController` class; the
  `handler_file` is the file containing the class method matching the
  route's HTTP verb.
- **File-based routing** (Nuxt `server/api/`, Next.js `app/`) —
  `handler_file == registration_file == <the file itself>`.

If the registration can't be resolved (e.g., dynamic dispatch via a
registry lookup, macro-expanded routes), set
`handler_file = registration_file`, emit `handler_hash: null`, and add
a `notes[]` entry explaining. **Never fabricate a path.**

**Step 2 — Extract the handler body from `handler_file`.**

- For brace-delimited languages (JS/TS/Go/Java/Kotlin/Rust/C#/PHP),
  start at the opening `{` of the handler function and end at the
  matching `}` (track nested braces).
- For indent-delimited (Python), start at the handler `def` line and
  include all lines with strictly greater indentation.
- For decorator-based (annotations like `@GetMapping`), the handler
  body is the function the annotation is attached to.

`line_range` records the start/end lines **within `handler_file`**.

**Step 3 — Normalize + hash.** Refer to `lib/handler-hash.md` — strip
comments, collapse whitespace, lowercase, sha1.

If the body cannot be extracted (e.g., metaprogrammed registration),
emit `handler_hash: null` and add a note. Never guess.

## 2.6 — Auth inference

For each surface, infer `auth_required`:

1. **Middleware present at route registration** — `app.get('/x', auth, handler)` → `true`.
2. **Decorator on the handler** — `@Authenticated`, `@PreAuthorize`, `@Require(...)` → `true`.
3. **Global middleware mounted before this route** — check the Phase 0
   `auth.middleware_paths` entries; if the route registration file imports
   the middleware and registers the handler inside the middleware's scope,
   infer `true`.
4. **Explicit unauthenticated marker** — `@Public`, `permit_unauthenticated`,
   route under `/public/`, `/health`, `/metrics` → `false`.
5. **Otherwise** → `unknown`. Flag in `notes` so Phase 5 category 1 can
   verify manually.

For `roles_required`, grep the handler body for role / scope assertions
(`hasRole`, `requireRole`, `canAccess`, `@PreAuthorize("hasRole('ADMIN')")`,
`request.user.is_staff`).

## 2.7 — Immediate-flag pre-filter

While enumerating, pre-tag surfaces with any of:

- `NO_AUTH_WRITE` — data_ops contains `write`/`delete`/`exec` and `auth_required: false`.
- `NO_AUTH_READ_SENSITIVE` — data_ops contains `read` and the partition sensitivity ≥2, and `auth_required: false`.
- `AUTH_UNKNOWN` — `auth_required: unknown`.
- `WILDCARD_METHOD` — file-based routing without a method suffix (e.g., Nuxt
  `server/api/x.ts` handling ALL methods).
- `ADMIN_NO_ROLE` — path matches `/admin|/actuator|/debug` and
  `roles_required` is empty.
- `RETURNS_OTHER_PRINCIPALS_ROWS` (v2.5) — the handler returns a **list** of an
  entity with `owner_cols`/`pii_cols` and the query applies **no caller-derived
  predicate**. Set this even when `auth_required` is `true` and `roles_required`
  is populated — **especially** then. This flag exists because every other field
  on the surface row records gate *presence*, and the defect being caught is
  authentication used where per-row authorization was required.
- `PERMISSION_DECORATION` (v2.5) — the handler computes a per-row permission
  (`can*`, `is*Allowed`, `*Permitted`) and attaches it to the response without
  filtering on it.

These tags go in the surface row's `flags[]` field. They are **not** findings
yet — Phase 5 turns them into severities.

> **Data breadth outranks the trust-zone label.** An "internal" endpoint whose
> query can return rows owned by principals other than the caller is higher risk
> than a "public" endpoint returning one row the caller owns. Where
> `RETURNS_OTHER_PRINCIPALS_ROWS` is set, it dominates the zone weight: Phase 7
> §7.4 treats it as a promotion signal that also vetoes any dev-zone demotion,
> and §2.13 below uses it to promote the whole partition into the deep-dive
> budget.

## 2.8 — Emit the inventory

Write the consolidated surface document to
`.claude-audit/current/phase-02-surface.json` with top-level shape:

```json
{
  "schema_version": 2,
  "skill_version": "...",
  "audit_id": "...",
  "generated_at": "...",
  "by_category": { "http": 61, "file_upload": 4, "queue_consumer": 0, "..." : 0 },
  "flags_summary": { "NO_AUTH_WRITE": 3, "AUTH_UNKNOWN": 12, ... },
  "surfaces": [ ... per-entry fields from §2.4 ... ]
}
```

Then run §2.11 to write `phase-02-sinks.json` and `phase-02-credentials.json`,
and §2.12 to write `phase-02-collections.json`. Apply §2.13 (evidence-based
partition promotion) before writing the marker. Write `phase-02.done` only after
all four artifacts exist.

## 2.9 — Report to user

> Phase 2 complete — <N> surfaces across <M> categories (<http count> HTTP
> routes, <K> file uploads, ...). <F> pre-flags raised: <breakdown>.
> Proceeding to Phase 3 (Keystone).

## 2.10 — Edge cases

- **Metaprogrammed / reflection-based routing.** Rails `routes.rb` with
  `resources :items`, Django `path(..., include('app.urls'))`, Spring
  `@RequestMapping` on a class. Resolve by following the indirection one
  level; if the resolution is dynamic (runtime-only), emit a surface with
  `path: "<dynamic>"` and a `notes` entry.
- **Shared handler reused at multiple routes.** Emit one surface per
  registration site (different `id`), but the `handler_hash` is the same —
  Phase 5 will deduplicate by hash where relevant.
- **Vendor code.** Any path matching an `ignore.txt` pattern is skipped —
  no surface emitted regardless of apparent route-like structure.

## 2.11 — Egress-sink inventory + credential ledger (v2.4, GLOBAL)

The surface inventory above catalogues **ingress**. This section catalogues
**egress of sensitive data** + the **credential mint/consume map** — the inputs
to the Phase 6 §6.19 Authorized-Egress reconciliation. Both files are GLOBAL
(span all partitions) because a credential's writer and a resource's byte-serving
sink routinely live in different partitions (the deck bug's cookie was minted in
`/s/...` and ignored in `/api/decks/...`).

**Method is deterministic-candidate-first (fail-closed).** Do NOT free-form
enumerate from memory — that is how sinks get missed:

1. **Extract candidates deterministically.** Grep the per-framework anchors in
   [`../lib/egress-detection.md`](../lib/egress-detection.md) to enumerate every
   candidate egress site and credential read/write site. This is the SAME
   candidate set the Phase 6 §6.19 coverage gate re-derives from source — so
   anything you miss here will be raised against you there (fail-closed). Use the
   catalogue, not memory.
2. **Account for EVERY candidate.** Each candidate becomes either a `sinks[]`
   row (a real sensitive-data emitter) or a `dismissed[]` row **with a reason**
   (e.g. "serves a public asset", "health check"). An unaccounted candidate
   FAILS `validate-egress.py` (fail-closed coverage) — silence is not allowed.
3. **Be path-sensitive.** For each sink, enumerate `guarded_paths[]` — **every
   branch** that can emit bytes, with the gate enforced on that branch. If a
   handler has more emitting branches than you can confidently enumerate (e.g.
   it exceeds ~40 lines or has multiple `return res.*`/early-return branches),
   set `coverage: "incomplete"` — that is itself a fail-closed deficit, not a
   silent pass.
4. **Map credentials.** For every minted claim (cookie/JWT/CSRF/signed-URL/
   capability/api-key/session/feature-flag/licence), record `writers[]`,
   `readers[]`, `validation_at_readers[]`, and `protects_resources[]` (canonical
   entity ids it is meant to gate).
5. **Type each sink (v2.6).** Set `layer`, `destination`, and — for any
   `local_fs` sink — `path_control`. Set `gate_rank_hint` on any branch whose
   gate you actually read. These are what make §6.19 precise rather than noisy;
   §2.11a explains each and what it cost when it was missing.

Write `phase-02-sinks.json` (schema `lib/sink-schema.json`) and
`phase-02-credentials.json` (schema `lib/credential-ledger-schema.json`).
Both ALWAYS written — empty arrays if nothing is found (the file's presence is
the signal that the egress pass ran). Validate each against its schema before
proceeding.

> Honest scope: this catalogue is the *known* egress surface. Accounting for
> every candidate means "nothing the catalogue can see was silently dropped" —
> it does NOT prove no unauthorized path exists. New modality found ⇒ extend
> `lib/egress-detection.md`.

> **v2.5 — sinks are not only byte sinks.** The sink inventory's `kind` enum now
> admits `json_collection`, `json_metadata`, and `identifier_list`. A JSON list
> of other principals' identifiers **is** an egress of sensitive data: UUIDs plus
> titles were the discovery half of a real incident, and because the v2.4 sink
> inventory admitted only byte-emitting sinks, the handler that served them never
> entered `phase-02-sinks.json` and §6.19 never evaluated it. If a surface emits
> a resource's *identity or metadata* to someone who should not know the resource
> exists, inventory it.

### 2.11a — Four fields that decide whether §6.19 is precise (v2.6)

The R-rules measured **19.8% true** over the first externally-triaged run. The
rules were not the problem — the *inputs* were. §6.19 joined every path that
named the same `serves_resource`, a free-text string, so a Vue click handler was
compared against a cron worker's HMAC gate. These four fields type that join.
**Every one is optional and defaults to v2.5 behaviour, so omitting them is
silent — it costs precision, not correctness. Set them.**

**`layer`** ∈ `http` | `browser` | `cli` | `worker` | `build` | `ipc` — on both
sinks and surfaces. The gate `floor` is computed per `(resource, layer)`, so this
is what stops a cron worker's HMAC being read as a weaker sibling of an HTTP RBAC
check. Set it explicitly wherever the path is ambiguous; the path-based fallback
cannot know that `app/` is the browser in Nuxt and server code in Rails. **A
browser row can never enforce a gate — the browser *is* the caller** — so
`layer: browser` removes the row from R2/R3/R5 rather than flagging it for a
gate it could not hold.

**`destination`** ∈ `network` | `local_fs` | `local_stdout` — on sinks. Only
`network` reaches R2/R3/R5. A `console.log` to the invoking developer's own
stdout and a `0600` write to the device's own home are not egress to an untrusted
caller; six of 49 sampled false positives were exactly that.

**`path_control`** ∈ `fixed` | `own_config` | `env` | `argv` | `repo` | `caller`
— on `local_fs` sinks. **This is the field new rule R6 keys on, and it is the
one most likely to be left unset on a real finding.** The calibrated run *missed*
a CRITICAL because a repo-steerable state directory made a hook write a live
access token into an attacker's working tree — no network call, so no egress rule
could see it. The discriminator is not "is it a file" but **who controls the
path**: `repo` or `caller` means an untrusted party steers it.

**`gate_rank_hint`** ∈ `none` | `authn` | `authz` | `verified` — on a branch
whose gate you have read and understood. It **overrides** the keyword ranker,
which is a fallback and no longer the authority. Set it whenever your gate
description is precise, because the v2.5 behaviour was perverse: the ranker
scores unrecognised text as `none`, so **the more accurately you described a real
control, the more likely it was to rank 0 and be filed CRITICAL.** One paragraph
of genuine, correct hardening — atomic rename, compare-and-swap, fail-closed
parse — was filed CRITICAL for containing none of the ranker's keywords.

## 2.12 — Collection inventory (v2.5, GLOBAL) — row scoping, not gate presence

§2.11 catalogues egress by **modality**. This section catalogues egress by
**row scope**, and it exists because a gate can be present, correct-looking, and
still wrong:

```ts
const session = await requireRole(event, 'reader')             // gate EXISTS
  .where(and(eq(decks.scope, 'user'), isNull(decks.deletedAt))) // no owner predicate
const tree = applyCanWrite(rawTree, session)                    // decorates, never filters
```

Every field in §2.4 records gate **presence**. None can express *"authentication
was used where per-row authorization was required"*. `phase-02-collections.json`
is that field.

**Method — deterministic-candidate-first (fail-closed), same discipline as §2.11:**

1. **Extract candidates.** For every handler in this partition, find every
   list-shaped query (`findMany`, `findAll`, `.select().from()`, `.objects.filter`,
   `session.query`, `Model.where`, `::all()`, `findAll(`, `.ToListAsync`,
   `SELECT … FROM`, GraphQL list fields). The Phase-6 §6.20 coverage gate
   re-derives this candidate set from source, so anything skipped here is raised
   against you there.
2. **Account for EVERY candidate** — a `collections[]` row or a `dismissed[]`
   row with a reason. Silence fails the run.
3. **Answer the row-scope question honestly.** `row_scope` describes how ROWS are
   constrained, *independent of the endpoint's auth gate*:
   - `caller_bound` — a predicate binds to caller identity. **Record
     `scope_evidence` with the actual predicate text.** A claim with no
     caller-derived token in its evidence is rewritten to `unscoped` by the
     reconciliation (rule C5), so an unevidenced claim buys nothing.
   - `visibility_filtered` — a per-row visibility helper is invoked **and its
     result filters** the collection.
   - `public_allowlisted` — the entity is on `profile.public_resources` (§0.12b).
   - `role_restricted` — the only constraint is a role check. This is **not** row
     scoping and is accepted only for admin-tier roles; `reader`, `member`,
     `user`, `contributor` do not qualify.
   - `unscoped` — no predicate references any caller-derived value. Filters on
     literals (`scope = 'user'`, `deletedAt IS NULL`, `status = 'active'`)
     constrain *which* rows, not *whose*.
   - `unknown` — could not be determined from the read region. Fail-closed:
     treated as unscoped, rated one rung lower with `POSSIBLE` confidence.
4. **Record the decoration antipattern.** Set `decorates_permission` when a
   per-row permission is computed and attached, and `filters_after_decoration`
   only when that permission actually filters the collection.
5. **Look for a base scope before flagging.** A `default_scope`, a repository
   that always injects the tenant, a Prisma client extension, or database
   row-level security **is** valid scoping — find it and record it as
   `scope_evidence`. Missing one is the main false-positive risk here.

Write `phase-02-collections.json` (schema
[`../lib/collection-schema.json`](../lib/collection-schema.json)). ALWAYS
written — `{"collections": [], "dismissed": []}` if the partition has no list
endpoints. Validate against the schema before proceeding.

## 2.13 — Evidence-based partition promotion (v2.5)

Phase 1 ranked partitions on *a-priori* signals (exposure, sensitivity, age)
because Phase 2 had not run yet. Phase 2 now holds *evidence*. Use it.

After the surface, sink, and collection inventories are written, scan every
partition currently marked `depth: "inventory-only"`. **Promote it to
`depth: "full"`** if any of its surfaces carries:

- `RETURNS_OTHER_PRINCIPALS_ROWS`, or
- `PERMISSION_DECORATION`, or
- `NO_AUTH_WRITE`, or
- `NO_AUTH_READ_SENSITIVE`, or
- `ADMIN_NO_ROLE`,

or if it contains any `collections[]` row with `row_scope ∈ {unscoped, unknown}`
on a non-allowlisted entity.

Rewrite `partitions.json` with the promoted depths, and record each promotion:

```json
{ "promotions": [
    { "partition": "server-api-content", "from": "inventory-only",
      "to": "full", "reason": "RETURNS_OTHER_PRINCIPALS_ROWS on app:http:0001",
      "evidence": "server/api/content/tree.get.ts:231" } ] }
```

**Why.** The partition holding the missed defect ranked #9 against a default
`top_n: 8`. It received a deep dive in that run *only* because a human promoted
it by hand on external-reachability grounds. A budget cut that lands on a
partition full of unscoped collection handlers is not a budget decision, it is a
coin flip — and one that had a 92-day cost. Promotion is uncapped by `top_n`:
evidence outranks the budget. Report the promotions to the user so the extra
runtime is explained rather than mysterious.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/phase-02-surface.json  \
  && test -f .claude-audit/current/phase-02-sinks.json \
  && test -f .claude-audit/current/phase-02-credentials.json \
  && test -f .claude-audit/current/phase-02-collections.json \
  && test -f .claude-audit/current/phase-02.done \
  && echo "phase-02 verified" \
  || { echo "phase-02 INCOMPLETE — re-write artifact(s) + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-02 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
