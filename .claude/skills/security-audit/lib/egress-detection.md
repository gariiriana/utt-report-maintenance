# Egress-Sink & Credential Detection — anchor catalogue (v2.6)

This file is the **deterministic ground truth** for the Authorized-Egress analysis
(`lib/validate-egress.py`). It enumerates, per framework, the code shapes that
can **emit a resource's bytes to a caller** (egress sinks) and the shapes that
**mint or consume a credential/claim** (the credential ledger). The extractor in
`validate-egress.py` greps these anchors to produce a *candidate* set; the Phase-2
agent must then **account for every candidate** — classify it a real sink/credential
(with per-branch authz) or `dismissed[]` it with a reason. Any unaccounted candidate
**fails** the run (fail-closed coverage). This closes the "a sink that's never
inventoried is never reconciled" hole.

> Recall, honestly bounded: this catalogue is the *known* egress surface. A clean
> reconciliation means "every candidate this catalogue can see was accounted for and
> gated" — **not** "no unauthorized path exists." CDN-edge egress with no code path,
> and any modality not listed here, are out of mechanical reach and surface as report
> caveats, never silently. Extend this file when a new modality is found.

## Why egress, not just ingress

The Phase-2 surface inventory catalogues **entry points** and infers `auth_required`
per row. A confused-deputy / missing-enforcer bug hides on the **egress** side: the
control exists at one layer (a resolver) while the byte-serving layer re-derives
authority from mere possession of an identifier. So we additionally enumerate *what
emits sensitive bytes* and check **every branch** of every emitter against the served
resource's **strongest intended gate** (computed per resource across all paths).

## Sink kinds (the `kind` enum in `lib/sink-schema.json`)

> **v2.5 — a metadata sink is a sink.** v2.4 admitted only byte-emitting sinks,
> and that scoping decision is *why* a handler returning a JSON tree of every
> user's private deck UUIDs, titles and owner rosters never entered this
> inventory and was never reconciled. Identifiers plus titles were the discovery
> half of a real incident. The enum now includes `json_collection` (a list of
> entity rows), `json_metadata` (one row's descriptive fields), and
> `identifier_list` (bare ids/paths/slugs). **If a surface tells a caller that a
> resource exists when they should not know it exists, inventory it.**
> Row-scoping itself is analysed separately by
> [`collection-schema.json`](collection-schema.json) + §6.20 — the two are
> complementary, not redundant: §6.19 asks "is this emission gated?", §6.20 asks
> "are these rows the caller's?".

`file`, `stream`, `db_entity`, `proxy`, `static`, `graphql_field`, `presigned_url`,
`websocket`, `sse`, `template`, `redirect`, `async_job`, `cdn`,
`json_collection`, `json_metadata`, `identifier_list`.

## Three fields that decide which rules apply (v2.6)

A sink's `kind` says what shape the emission has. Three further fields say *who
is on the other end*, and without them the reconciliation compared things that
share nothing but a resource name. Over a calibrated run the R-rules were **19.8%
true**; typing these three is what that number bought.

### `layer` — where the code runs (story 2.4)

`http` | `browser` | `cli` | `worker` | `build` | `ipc`

The gate floor for a resource is computed **per `(serves_resource, layer)`**. A
browser component (`app/**`), a developer CLI (`plugin/scripts/**`), a cron
worker (`server/workers/**`) and an HTTP handler (`server/api/**`) do not enforce
each other's gates. Two measured false positives this kills:

- a `console.log(JSON.stringify(summary))` in a developer's own CLI, flagged
  because the resource's floor came from a **cron scheduler** resolve-layer
  surface;
- `ExportCsvButton.vue:31`, a client-side `<a download>` click, flagged for not
  having a server gate — the gate lives in `server/api/v1/reports/export.get.ts`,
  which is exactly where it belongs.

A Vue click handler *cannot* enforce a gate; a cron worker's HMAC is *not* a
weaker sibling of an HTTP RBAC check. `validate-egress.py` infers the layer from
the path (and, for surfaces, from `category`), then from the partition id, then
defaults to `http` — so an inventory that sets nothing reconciles exactly as v2.5
did. **Set it explicitly where the path is ambiguous:** Next.js `app/api/**` is
`http`, Nuxt `app/**` is `browser`.

### `destination` — who receives the bytes (story 2.5)

`network` (default) | `local_fs` | `local_stdout`

Only `network` sinks go through the authorization rules R2/R3/R5. **A
`writeFileSync(…, {mode: 0o600})` into the device's own home directory, and a
`console.log` to the invoking developer's own stdout, are not egress to an
untrusted caller** — there is no caller to authorize and no place to put a gate.
Six of 49 sampled R-rule false positives were exactly these two shapes. Inventory
them anyway (they are still candidates and the coverage gate still demands them);
they are evaluated by R6 below instead.

### `path_control` — who chooses the destination path (story 4.3)

`fixed` | `own_config` | `env` | `argv` | `repo` | `caller`

See the next section. This is the field that separates the benign `0600` write
from the critical one, and **the discriminator is who controls the path, not
whether it is a file** — both cases are the same `writeFileSync` call.

## Non-network modality: local-filesystem exfil (v2.6, story 4.3)

> A repo-steerable state directory made a hook write a **live OAuth access token
> into an attacker's own working tree**. There is no network call anywhere in
> that path, so no egress rule in v2.5 could see it, and the calibrated run
> missed it entirely — the triagers rated it CRITICAL. `lib/egress-detection.md`
> modelled network modalities only. This section is the fix.

**The model.** Exfiltration is *bytes reaching a reader the operator did not
choose*. A network send is one way to arrange that; writing to a location
somebody else controls is another, and it leaves no trace in any HTTP inventory.
So a filesystem write is a sink whenever the **path is not under the operator's
control**, and it is CRITICAL when what lands there is a live credential.

**Anchors (all languages).** Inventory these as `destination: local_fs` and
record `path_control`:

- Node: `writeFileSync\(`, `fs\.promises\.writeFile\(`, `createWriteStream\(`,
  `appendFileSync\(`, `outputFile\(`, `fs\.cp\(`, `renameSync\(`
- Python: `open\([^)]*['\"][wa]`, `Path\(...\)\.write_(text|bytes)\(`,
  `shutil\.(copy|move)\(`, `json\.dump\(`, `tempfile\.(mkstemp|NamedTemporary)`
- Ruby: `File\.(write|open)\(`, `FileUtils\.(cp|mv)\b`
- Go: `os\.(WriteFile|Create)\(`, `io\.Copy\(\s*f\b`
- Java/.NET: `Files\.write\(`, `FileOutputStream\(`, `File\.WriteAllText\(`
- Shell: `>\s*\$?[A-Za-z_/.]`, `tee\b`, `cp\b`, `install -m`

**Then answer the only question that matters — where does the path come from?**

| `path_control` | Means | Verdict |
|---|---|---|
| `fixed` | a compile-time constant path | benign — no finding |
| `own_config` | derived from the operator's own config / `$HOME` / OS state dir | benign — no finding (this is story 2.5's case) |
| `env` | from an environment variable the process inherits | **steerable** |
| `argv` | from a command-line argument | **steerable** |
| `repo` | from a file or config inside the analysed repository/working tree | **steerable** |
| `caller` | from a request parameter | **steerable** |

`env` and `argv` look operator-controlled and are not: a hook, plugin runner or
agent invoked with repository-supplied configuration takes its argv and
environment from **the repo**, which is the attacker's input. That is precisely
the shape that was missed.

**Severity (rule R6).** Steerable path + the credential ledger records a
`writers[]` site at this line (or `carries_credential: true`) ⇒ **CRITICAL**.
Steerable path + a non-public resource ⇒ **HIGH**. `path_control` omitted on a
credential-carrying write ⇒ **MEDIUM**, asking for the field — an undetermined
path is a gap in the *inventory*, not evidence of a defect, and must not
manufacture a HIGH. A credential written to `local_stdout` ⇒ **MEDIUM**
(`CWE-532`): stdout is not caller-facing, but CI logs, hook transcripts and shell
scrollback capture it verbatim.

**Honestly bounded, twice over.**

1. R6 models *who chooses the path*. It does not model file modes, umask,
   symlink races, or a `fixed` path that happens to be world-readable
   (`/tmp/token.json`) — those remain cat-07 deployment concerns. The claim is
   that the class is now *expressible*, not that the model is complete for it.
2. **The compiled extractor in `validate-egress.py` is narrower than the anchor
   list above, and deliberately so.** Every other anchor in this file is broad by
   doctrine (recall over precision, the agent prunes into `dismissed[]`), but
   `writeFileSync` is not a rare shape and an unqualified sweep would add
   hundreds of rows to a *fail-closed* gate. Story 2.8 is the record of what
   happens then: 64 phantom coverage failures masked 7 real credential gaps and
   129 real collection gaps. So the extractor raises a `local_fs` candidate only
   when the write line **also** names something credential-shaped
   (`token|secret|credential|api_key|bearer|oauth|session|cookie|private_key|…`).
   A credential persisted through a variable bound on an earlier line will not be
   raised as a candidate and **is the agent's job** — inventory it by hand. That
   residual is stated here rather than papered over, because a coverage gate
   nobody trusts is worse than a narrow one.

## Egress anchors by modality (regex, language/framework-tagged)

Anchors are intentionally broad (recall over precision); the agent prunes false
candidates into `dismissed[]`. `validate-egress.py` embeds a compiled subset of these.

### Node / Express / Koa / Fastify / Nest / Nuxt / Next
- file / stream:  `\bres\.(sendFile|download)\b`, `\bcreateReadStream\b`,
  `\.pipe\(\s*res\b`, `\bsendStream\b`, `\bstreamFile\b`, `reply\.(sendFile|send)\(`
- auto-serializer: `\bres\.(json|send|end)\(`, `reply\.send\(`, `return\s+.*\b(deck|user|account|order|invoice|file|document|record)\b` (entity-return heuristic)
- static / proxy: `express\.static\(`, `serveStatic\(`, `createProxyMiddleware\(`,
  `http-proxy`, `\bproxy\(`, `sendFile\(`
- template / SSR: `res\.render\(`, `reply\.view\(`, `renderToString\(`
- redirect-with-data: `res\.redirect\([^)]*\?[^)]*(token|key|data|payload)`
- presigned URL: `getSignedUrl\(`, `\.presign(ed)?(Url|Post)?\(`, `createPresignedPost\(`, `generateSignedUrl\(`
- websocket / SSE: `\.(send|emit)\(`, `socket\.emit\(`, `ws\.send\(`,
  `res\.write\(\s*['"]?data:`, `text/event-stream`

### Python / Django / DRF / FastAPI / Flask
- `JsonResponse\(`, `StreamingHttpResponse\(`, `FileResponse\(`, `HttpResponse\(`,
  `send_file\(`, `FileResponse\(`, `return\s+\w+Serializer\(`, `Response\(serializer`,
  `\.render\(`, `RedirectResponse\(`, `StreamingResponse\(`, `return\s+[A-Z]\w+\b` (Pydantic model return)

### Ruby / Rails
- `render\s+json:`, `send_data\b`, `send_file\b`, `render\s+(plain|xml|html):`,
  `redirect_to\b`, `ActionController::Live`, `response\.stream`

### Java / Spring / Kotlin
- `@ResponseBody`, `ResponseBodyAdvice`, `ResponseEntity\.(ok|of)\(`,
  `StreamingResponseBody`, `produces\s*=`, `@GetMapping`.*`return\s+\w+` (entity return),
  `Files\.copy\(`, `InputStreamResource\(`

### Go
- `json\.NewEncoder\(\s*w\s*\)\.Encode\(`, `w\.Write\(`, `io\.Copy\(\s*w`,
  `http\.ServeContent\(`, `http\.ServeFile\(`, `c\.JSON\(`, `c\.File\(`, `c\.Stream\(`

### .NET / ASP.NET
- `return\s+File\(`, `PhysicalFile\(`, `return\s+Ok\(`, `FileStreamResult`,
  `[Pp]roduces`, `Results\.(File|Stream|Json)\(`

### GraphQL (all languages)
- `@ResolveField`, `@FieldResolver`, `resolve\s*[:=]`, `Query\s*:`, `fieldResolver`,
  `buildSchema`, `@Resolver` — every field resolver that returns a sensitive column is a sink.

### gRPC (all languages)
- `stream\.Send\(`, `return\s+&pb\.`, `return\s+\w+Reply\b`, `responseObserver\.onNext\(`

### Async / off-request egress
- `@(KafkaListener|RabbitListener|SqsListener)`, `\.perform_async\b`, `@app\.task`,
  `BullMQ`, `exportToCsv\(`, `generateReport\(`, `\.upload\(.*public`, `putObject\(.*ACL.*public`

### CDN / cache (header-level — no code path; report-caveat class)
- `Cache-Control:\s*public`, `s-maxage`, `CDN`, `CloudFront`, `Surrogate-Control`
  — flagged as `kind: cdn`, `coverage: caveat` (cannot be mechanically gated).

## Credential mint / consume anchors (the ledger, `lib/credential-ledger-schema.json`)

A credential is anything **issued** that later gates access. For each, the extractor
finds WRITE sites (mint) and READ sites (consume); the agent records both. The
asymmetry (writers without consuming readers on the byte path) is the core signal.

- cookies / capability: `set-?[Cc]ookie`, `cookies\.set\(`, `res\.cookie\(`,
  `serialize\(\s*['"]\w+`, `__\w+`, `setHeader\(\s*['"]Set-Cookie` ;
  consume: `cookies\.get\(`, `req\.cookies\b`, `parse\(\s*cookieHeader`
- JWT / session: `sign\(`, `jwt\.sign\(`, `createToken\(`, `req\.session\b`,
  `getServerSession\(`; consume: `verify\(`, `jwt\.verify\(`, `decode\(`
- CSRF: `csrf`, `xsrf`
- signed/presigned URL: `getSignedUrl\(`, `presign`, `hmac`, `createHmac\(`
- api key / PAT: `apiKey`, `personal.?access`, `x-api-key`
- feature flag / licence gate: `isEnabled\(`, `flag\(`, `entitled\(`, `licen[cs]e`

For every minted credential C the agent records `protects_resources[]` (which
resources C is supposed to gate). A credential that protects R raises R's **gate
floor**, so any byte-serving path to R weaker than that floor is flagged as a
deficit; a credential with **zero readers anywhere** is flagged as theatre (R4).

## Ranking & coverage semantics (so the agent writes useful inventories)

- **`gate_rank_hint` outranks the keyword ranker (v2.6, story 2.7).** Set
  `gate_rank_hint` to `none` | `authn` | `authz` | `verified` on any branch (and
  on `intended_gate`) and that is the rank used; the keyword table is only the
  fallback. **Set it whenever a real control does not read like
  `role`/`session`/`2fa`.** Unrecognised text ranks NONE, and a rank-0 branch
  under a rank-2 floor is filed CRITICAL, so before v2.6 *the more precisely you
  described a real control, the more likely it was filed CRITICAL*. This gate
  text was filed CRITICAL in the calibrated run:

  > "0600 + chmod + atomic rename, with a compare-and-swap against the bytes read
  > so a concurrent redeem's freshly written credential is never clobbered;
  > unparseable JSON aborts rather than rewrites"

  The hint can only make the detector quieter, so it is never applied silently:
  the run reports how many hints were applied, how many raised a rank the ranker
  would not have given, and prints to stderr every hint that contradicts negated
  prose sitting beside it.
- **Gate ranking is negation-aware** (the fallback path). Each branch's
  `enforced_gate` is ranked NONE < AUTHN < AUTHZ < VERIFIED by keyword, but a
  description of an *absent* control ("no role check", "unauthenticated",
  "missing ownership") ranks **NONE** even though it contains positive keywords,
  and unrecognized text ranks NONE. Write what is *actually enforced on the
  branch* (or "none") — over-describing a gap as a gate is the one way to defeat
  the detector, and the ranker defends against it by failing conservative
  (over-flag, never silently pass).
- **A credential *kind* cannot set a floor nobody can reach (v2.6, story 2.6).**
  `capability`, `signed_url` and `verification` imply rank 3, but a kind is a
  taxonomy label, not evidence. A kind-derived rank is now capped at AUTHZ unless
  a real gate *text* at rank 3 is observed somewhere for that same resource.
  Measured: request-scoped Postgres RLS GUCs inventoried as kind `capability`
  gave every resource they touched floor 3 in an application with **no step-up
  auth at all**, so the correctly gated branch was filed HIGH.
- **Coverage is line-scoped.** Each candidate `(file, line)` must be matched by a
  sink/credential/dismissal in the same file within ~15 lines. One inventoried
  sink does **not** account for another sink elsewhere in the same file — list
  every emitting site or dismiss it explicitly.
- **Coverage respects `.claude-audit/ignore.txt` (v2.6, story 2.8).** Same file,
  flag and glob semantics as `validate-partition-coverage.py`. Before v2.6 only
  that one validator read it, so a calibrated run demanded inventory entries for
  an unrelated repository the operator had cloned under `tmp/`. That, plus a
  `_norm` bug that rewrote `.output/` to `output/`, produced **64 phantom
  coverage failures which masked 7 real credential gaps and 129 real collection
  gaps** — a fail-closed gate failing in the *noisy* direction is the specific way
  a fail-closed gate stops being trusted.
