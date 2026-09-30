# Phase 0 — Discovery & Recon

## 🛑 MANDATORY EXECUTION RULES (READ FIRST)

📋 **This phase MUST produce, on disk, before advancing:**
- `.claude-audit/current/phase-00-profile.json` (schema-valid per `lib/profile-schema.json`)
- `.claude-audit/current/phase-00.done` (zero-byte marker)

⛔ **DO NOT advance to Phase 1** until both files exist AND the Bash verification block at the bottom of this file prints `phase-00 verified`.

📖 Writing only the final report without this artifact is an **INVALID run**. Every later phase (partition risk ranking, framework-driven surface enumeration, Phase 5 fan-out) reads `phase-00-profile.json` as authoritative input.

---

**Goal.** Build the Project Map — a single JSON document that every later
phase reads. Nothing deep happens until this is complete.

**Input.** The project root (the skill-user's working directory).

**Output.** `.claude-audit/current/phase-00-profile.json` conforming to
`lib/profile-schema.json`.

**Budget.** Single orchestrator pass. No sub-agents. Aim for ≤30 file reads
and 1-2 shell invocations.

**Principle.** Confirm every detection with file evidence. Never guess. If a
field cannot be derived with evidence, set it to `null` / `[]` and record the
reason in `notes[]`.

---

## 0.1 — Git state

Record:
- `git.head` — `git rev-parse HEAD`
- `git.branch` — `git rev-parse --abbrev-ref HEAD`
- `git.remote` — `git remote get-url origin` (null if missing)
- `git.dirty` — `true` if `git status --porcelain` has output

Compute `audit_id = sha256(git.head + top-level dir listing)` as the stable
run identifier.

## 0.2 — Repo size

Prefer `cloc --json --vcs=git .` if available. Fall back in order:
1. `tokei -o json`
2. Manual: enumerate files with `git ls-files`, classify by extension against
   a minimal extension→language map, count lines with `wc -l`.

Emit:
- `repo.loc_total`
- `repo.loc_by_language`: `{language_name: loc}`
- `repo.file_count`
- `repo.top_level_dirs`: the names of directories at the repo root (excluding
  `.git`, `node_modules`, `dist`, `build`, `target`, `.venv`, `__pycache__`).

## 0.3 — Topology detection

Probe for monorepo tools (stop at first match, record all that apply):

| Tool | Signal |
|---|---|
| nx | `nx.json` |
| turbo | `turbo.json` |
| pnpm workspaces | `pnpm-workspace.yaml` |
| yarn workspaces | `package.json` with `"workspaces"` key |
| npm workspaces | same as yarn |
| lerna | `lerna.json` |
| rush | `rush.json` |
| bazel | `WORKSPACE`, `WORKSPACE.bazel`, `MODULE.bazel` |
| go workspace | `go.work` |
| cargo workspace | `Cargo.toml` with `[workspace]` table |
| poetry workspaces | `pyproject.toml` with multi-project layout |
| multi-service | `services/*/Dockerfile` OR `packages/*/package.json` |
| submodules | `.gitmodules` present |

Emit:
- `topology.kind`: `monorepo` | `multi-service` | `single` | `unknown`
- `topology.tool`: first monorepo tool matched, else `null`
- `topology.workspaces`: list of workspace paths (resolved from the tool's
  config)
- `topology.services`: list of service paths (from Dockerfile probes)
- `topology.submodules`: list of submodule paths

## 0.4 — Language inventory

From `repo.loc_by_language`, emit `languages[]` sorted by LOC descending:
```json
[{"name": "TypeScript", "loc": 45000, "files": 120, "primary": true}]
```

`primary: true` on the top language, `false` on the rest. Skip languages with
<100 LOC unless they are config-only (YAML, TOML, Dockerfile, Terraform).

## 0.5 — Framework detection

For each language with significant LOC, probe the framework signals in
`lib/framework-detection.md`. Examples:

- **Python**: `pyproject.toml`/`requirements.txt`/`Pipfile` for `django`,
  `flask`, `fastapi`, `starlette`, `djangorestframework`.
- **Java/Kotlin**: `build.gradle*` or `pom.xml` for `spring-boot-starter-*`,
  `micronaut-*`, `quarkus-*`, `ktor-*`.
- **Go**: `go.mod` for `gin-gonic/gin`, `labstack/echo`, `go-chi/chi`,
  `gofiber/fiber`.
- **Ruby**: `Gemfile` for `rails`, `sinatra`.
- **PHP**: `composer.json` for `laravel/framework`, `symfony/*`,
  `wordpress`.
- **.NET**: `*.csproj` for `Microsoft.AspNetCore.*`.
- **Rust**: `Cargo.toml` dependencies for `axum`, `actix-web`, `rocket`.
- **Elixir**: `mix.exs` for `phoenix`.
- **JS/TS**: `package.json` dependencies for `next`, `nuxt`, `express`,
  `fastify`, `hono`, `koa`, `@trpc/server`, `@nestjs/core`.

Emit `frameworks[]`:
```json
[{"language": "TypeScript", "framework": "Nuxt", "version": "3.x", "evidence": "nuxt.config.ts"}]
```

If a language has unknown framework, emit one entry with `framework: null`
and set `evidence` to the manifest file you checked.

**Conflict resolution.** If multiple manifests for the same language
declare different frameworks (e.g., a Python project with both
`pyproject.toml` declaring `fastapi` and a legacy `requirements.txt`
declaring `flask`), emit **one entry per detected framework** with
distinct `evidence` paths. Downstream phases (Phase 2 surface
inventory) will then exercise each framework's detection patterns —
correct behavior for a migration-in-progress codebase. Do NOT pick
one and discard the other; that would silently skip surfaces from the
second framework.

## 0.6 — Non-HTTP surfaces (hint only — Phase 2 does inventory)

Probe for presence signals. Do **not** enumerate surfaces here — that is
Phase 2's job. Set booleans / lists on `surfaces_hint`:

| Field | Signal |
|---|---|
| `grpc` | any `*.proto` file |
| `graphql` | any `*.graphql`/`*.gql` file, or `graphql` import |
| `websocket` | `ws`/`socket.io`/`@WebSocketGateway`/`ActionCable`/Phoenix.Channel imports |
| `sse` | `text/event-stream` string occurrence |
| `trpc` | `@trpc/server` import |
| `queue` | list of detected systems: Kafka, RabbitMQ, SQS, NATS, Redis |
| `scheduler` | list: celery, sidekiq, bullmq, resque, hangfire, cron, systemd |
| `webhook` | route handler with `X-Hub-Signature` / `signature` header probe |
| `file_upload` | `multipart/form-data` occurrence or framework upload primitive |
| `serverless` | `template.yaml`/`function.json`/`wrangler.jsonc`/`serverless.yml` |
| `mobile` | `AndroidManifest.xml` / iOS `Info.plist` |
| `desktop` | `ipcMain.handle` / `#[tauri::command]` / Electron main |
| `admin_endpoints` | paths matching `/actuator/*`, `/debug/pprof`, `/__debug__` |
| `cli_admin` | `bin/` directory, `lib/tasks/`, `app/Console/Commands/` |

## 0.7 — Auth system

Search for auth patterns, record what you find:

- **Kinds** — detect presence of: `session`, `jwt`, `api_key`, `pat`, `oauth`.
- **Middleware paths** — files exporting functions matching
  `auth|authz|guard|require*|middleware|currentUser|getSession|protect`.
- **Frameworks** — `passport`, `next-auth`, `@sidebase/nuxt-auth`, `lucia`,
  `better-auth`, `clerk`, `spring-security-*`, `devise`, `django.contrib.auth`,
  `flask-login`, `laravel/sanctum`, `laravel/passport`.

Emit `auth` object with those three fields. If none detected, set arrays to
`[]` and add a `notes[]` entry.

## 0.8 — Data model

Find ORM / schema files:

| Stack | Signal |
|---|---|
| Drizzle | `drizzle.config.*`, `*/schema.ts` |
| Prisma | `schema.prisma` |
| TypeORM | imports of `typeorm` |
| Sequelize | imports of `sequelize` |
| Django ORM | `models.py` |
| SQLAlchemy | imports of `sqlalchemy` + `Base` usage |
| JPA/Hibernate | `@Entity` annotations |
| ActiveRecord | `app/models/*.rb` with `ApplicationRecord` |
| Eloquent | `app/Models/*.php` |
| Ecto | `schema do` blocks in Elixir |

For each detected schema file, extract:
- Entities (table/model names)
- Ownership columns: any column name matching `user_id|userId|ownerId|createdBy|organizationId|tenantId|accountId`
- PII columns: any column name matching `email|phone|dob|ssn|passport|address|ip|full_name|firstName|lastName|birthdate`

Emit (include a canonical `id` per entity — the join key the Authorized-Egress
reconciliation uses; default it to the entity name):
```json
{
  "orm": "drizzle",
  "schema_files": ["drizzle/schema.ts"],
  "entities": [{"name": "User", "id": "User", "owner_cols": ["id"], "pii_cols": ["email"]}]
}
```

> The `owner_cols` / `pii_cols` here are ONE source of "this resource is
> sensitive" — they are not the only source, and they are not required to be
> complete. The Authorized-Egress reconciliation (v2.4) is **default-deny**:
> any served entity is treated as sensitive unless you place it on the
> `public_resources` allowlist (§0.12b). A resource gated by a share/2FA
> mechanism (§0.11d) is sensitive even with no ownership column — that is the
> exact case the deck-2FA bug exploited.

## 0.9 — Deployment

| Category | Signal |
|---|---|
| `docker.dockerfiles` | `**/Dockerfile`, `**/Dockerfile.*` |
| `docker.compose` | `docker-compose*.yml`, `compose*.yml` |
| `k8s.manifests` | `*.yaml`/`*.yml` with `kind:` in (`Deployment`, `StatefulSet`, `DaemonSet`, `Service`, `Ingress`) |
| `k8s.helm_charts` | `Chart.yaml` |
| `iac.terraform` | `*.tf`, `*.tfvars` |
| `iac.cloudformation` | `*.cf.yml` / `cloudformation/*.yaml` / `template.yaml` |
| `iac.bicep` | `*.bicep` |
| `ci.github_actions` | `.github/workflows/*.yml` |
| `ci.gitlab_ci` | `.gitlab-ci.yml` |
| `ci.circleci` | `.circleci/config.yml` |
| `ci.buildkite` | `.buildkite/pipeline.yml` |

Emit `deployment` object with each sub-field as a list of matched paths.

## 0.10 — Trust zones

Classify each partition-candidate as `public | internal | admin | dev`.

Evidence sources (in priority order):
1. **Ingress / gateway config** — parse `nginx.conf`, `alb-*.yaml`, API
   gateway route tables.
2. **OpenAPI `servers:`** — `openapi.yaml` / `openapi.json` may hint at
   production vs staging endpoints.
3. **README** — explicit mentions of "public API", "internal service", etc.
4. **Dir naming** — `services/public-*`, `services/admin-*`, `apps/dashboard`.
5. **Default** — if nothing else, mark `internal`.

Emit `trust_zones[]`:
```json
[{"name": "public", "sources": ["nginx.conf:42"], "paths": ["services/api"]}]
```

## 0.11 — LLM usage

Grep imports for `anthropic|openai|langchain|llamaindex|ollama|@anthropic-ai/sdk|@langchain/*`. If matches found, do a second pass to distinguish **user-facing** LLM features from **internal telemetry / tooling** usage:

- **User-facing** heuristic: the LLM SDK is imported in a file that also
  handles an HTTP route or WebSocket, or a file whose name contains `chat`,
  `assistant`, `agent`, `completion`.
- **Internal only** heuristic: SDK imported only in scripts/CLIs or background
  jobs.

Emit:
```json
{
  "detected": true,
  "kind": "user-facing" | "internal" | "mixed",
  "sdks": ["anthropic"],
  "evidence": ["server/api/chat.post.ts", "package.json:@anthropic-ai/sdk"]
}
```

The LLM deep-dive category (Phase 5 #9) is gated on `detected && kind != "internal"`.

## 0.11b — MCP / agentic surface

SEPARATE from §0.11. An MCP server, MCP client, or agent tool-loop is a distinct
attack surface (tool poisoning, prompt-injection-via-tool-output, confused
deputy) that the LLM gate above would wrongly skip. Detect:

- **MCP**: files `*.mcp.json` / `.mcp.json` / `mcp.json`; deps
  `@modelcontextprotocol/sdk`, `modelcontextprotocol`, `fastmcp`, `mcp`
  (PyPI); code `from mcp.server`, `FastMCP(`, `@mcp.tool`, `server.tool(`,
  `setRequestHandler(`, `registerTool(`; STDIO/transport config.
- **Agent frameworks / tool loops**: `langgraph`, `@langchain/langgraph`,
  `crewai`, `autogen`, `llama_index.*agent`, OpenAI/Anthropic tool-calling
  loops (`tools=[`, `tool_use`, `function_call`) that feed results back to
  the model.
- **This-repo dogfood**: `.claude/agents/*`, `.claude/settings*.json`
  permission scopes, sub-agent prompt interpolation.

Emit:
```json
{
  "detected": true,
  "kind": "mcp-server" | "mcp-client" | "agent-framework" | "mixed",
  "servers": ["src/mcp/server.py"],
  "evidence": ["package.json:@modelcontextprotocol/sdk", ".mcp.json"]
}
```
into `mcp_agentic`. The MCP/agentic deep-dive (Phase 5 cat-11) is gated on
`mcp_agentic.detected == true`. Absent ⇒ not detected ⇒ cat-11 skipped.

## 0.11c — Supply-chain surface

Always informs cat-10 (which runs regardless), scoping it to what's present:

- **ecosystems**: from manifests (npm/pypi/go/cargo/rubygems/composer/nuget…).
- **lockfiles**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`,
  `poetry.lock`, `Cargo.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`.
- **ci_systems**: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`,
  `.circleci/`, `azure-pipelines.yml`, `bitbucket-pipelines.yml`.

Emit into `supply_chain`:
```json
{
  "detected": true,
  "ecosystems": ["npm"],
  "lockfiles": ["package-lock.json"],
  "ci_systems": [".github/workflows"],
  "evidence": ["package.json", ".github/workflows/ci.yml"]
}
```

## 0.11d — Access / share mechanisms (confused-deputy precursor)

A share/capability mechanism gates access at a **discovery layer** (resolve a
short link, mint a signed URL) that is often SEPARATE from the **content layer**
that serves the bytes. When the content layer doesn't re-enforce the gate, you
get the control-with-no-enforcer / capability-URL class (the deck-2FA bug). Detect:

- **Publish / share links**: routes like `/s/:shortId`, `/share/:token`,
  `publishLink`, `shareToken`, columns `requireVerification` / `is_public` /
  `expires_at` on a share table.
- **Signed / capability URLs**: `getSignedUrl`, `presign`, HMAC-signed query
  params, magic links.
- **Verification gates**: email-code / 2FA / OTP on a share flow; a
  verification cookie (`__sv_`-style) minted by a resolver.

Emit into `access_mechanisms`:
```json
{
  "detected": true,
  "kinds": ["publish_link", "verification"],
  "evidence": ["server/api/s/[shortId].get.ts", "schema: publishLinks.requireVerification"]
}
```
Absent ⇒ none detected. This feeds Phase 2's egress inventory and the Phase 6
§6.19 Authorized-Egress reconciliation. Any resource reachable through such a
mechanism is **sensitive** for default-deny purposes regardless of ownership cols.

## 0.12 — PII classification

From Phase 0.8, if any entity has PII columns, mark `pii.detected: true` and
collate:
```json
{
  "detected": true,
  "columns": ["users.email", "users.phone"],
  "frameworks_support": ["drizzle"]
}
```

This gates LINDDUN privacy review (Phase 6).

## 0.12b — Public-resource allowlist (default-deny sensitivity)

The Authorized-Egress reconciliation treats every served entity as sensitive
**unless** it is explicitly intended to be public. Build that allowlist here so
default-deny doesn't drown the report in false positives on genuinely-public data.

A resource belongs on `public_resources` ONLY with positive evidence of intended
public access: a `/public/` route, an `is_public`/`published` flag with no
verification, README/marketing copy ("public product catalog"), or a CMS/blog
content type. **When in doubt, leave it OFF** (default-deny — a false positive is
triaged; a false negative is the deck bug).

Emit the canonical entity ids at the top level:
```json
{ "public_resources": ["Product", "BlogPost", "Category"] }
```
This list is surfaced in the Phase 7 report for human review — it is the one
place where "we decided this is public" is auditable.

## 0.13 — Ignore list

Produce `ignore.txt` at `.claude-audit/ignore.txt` — patterns downstream
phases (especially Phase 5 greps) must respect. Seed with:

```
# Standard ignores
.git/
node_modules/
dist/
build/
target/
.venv/
venv/
__pycache__/
vendor/
.next/
.nuxt/
.output/
coverage/
.pytest_cache/
.tox/

# Generated code markers (add if detected)
**/*.generated.*
**/*.pb.go
**/*_pb2.py
**/*.d.ts
openapi-codegen/

# Test fixtures (matched by dir)
**/testdata/
**/fixtures/
**/__fixtures__/
**/test-fixtures/
```

Append project-specific additions based on what you discovered in 0.3 (monorepo
ignore paths) and 0.9 (build outputs).

## 0.14 — Capability lexicon (personas + crown jewels) — v2.5

The Phase-7 severity gate (`lib/compose-attack-paths.py`) composes findings into
attack paths and recomputes severity over them. It needs two project-specific
inputs, and it needs them expressed in one vocabulary — see
[`../lib/capability-lexicon.md`](../lib/capability-lexicon.md) for the grammar.

Derive them **by rule, not by taste**, and emit at the top level of the profile:

```json
{
  "capability_lexicon": {
    "personas": {
      "anonymous":            [],
      "external_link_holder": ["external:link_holder"],
      "lowest_tier_user":     ["authenticated", "role:reader"],
      "authenticated_user":   ["authenticated"]
    },
    "unprivileged": ["anonymous", "external_link_holder", "lowest_tier_user"],
    "crown_jewels": ["reads:any_deck_content", "reads:any_user_pii", "escalates:admin"]
  }
}
```

**Personas.** Always include `anonymous`. Then add one per externally-obtainable
credential class:
- a persona per share / capability-URL / 2FA-link mechanism found in §0.11d
  (holds `external:link_holder`);
- **the lowest role an outsider can self-provision.** If SSO auto-provisions a
  role on first login, that role is `lowest_tier_user` and it belongs in
  `unprivileged` regardless of how the organisation describes it internally.
  Getting this wrong is what makes an "internal, authenticated-only" endpoint
  look safe when in practice anyone with a corporate email reaches it.

**Crown jewels.** Emit:
- `reads:any_<e>_content`, `reads:any_<e>_pii` (when `pii_cols` is non-empty),
  and `writes:any_<e>` for every `data_model` entity with non-empty `owner_cols`
  or `pii_cols`, **excluding** anything on `public_resources` (§0.12b);
- `reads:any_user_pii` when `pii.detected`;
- `reads:cross_tenant_<x>` when a tenant/org column exists;
- `escalates:admin`, always.

**Integrity crown jewels (v2.6).** Every jewel rule above is a
*confidentiality* rule. Also emit `corrupts:any_<e>_record` for each entity
that is a **system of record for a process outside its own service** —
billing, attribution, reconciliation, metering, audit, compliance export. The
test is not "is this data sensitive" but "does something outside this codebase
act on it as if it were true". Without at least one integrity jewel, rule R3
cannot rate an availability/integrity chain above whatever its individual legs
were asserted at — which is exactly how a HIGH-severity estate-wide silent
attribution stop went unrated in the calibrated run. See
[`../lib/capability-lexicon.md`](../lib/capability-lexicon.md) §2 and
[`deepdive/lens-availability-integrity.md`](deepdive/lens-availability-integrity.md).

If you cannot derive these, emit the object with the defaults above and add a
`notes[]` entry — the composer falls back to built-in patterns, but a
project-specific list is materially more precise, and a silently-absent lexicon
is a silently-weakened gate.

## 0.15 — Design records (decision-record deference) — v2.6

**Why this is a discovery step and not a Phase-5 step.** A deep-dive sub-agent
is scoped to a partition and told not to read outside it. Decision records
live at the repo root, in `docs/`, or in a `doc/architecture/decisions/`
directory that belongs to no partition — so an agent that should defer to one
will never see it unless Phase 0 puts the path in the profile. In the
calibrated run, the report filed a deliberate, documented asymmetry as a theme
(*"The asymmetry **is** the finding"*) while the project's own ratified record
named the compensating control. Acting on the remediation would have added a
call that cannot fire, against the design record.

**Locate, do not read.** Phase 0's budget is ≤30 file reads; this step is
path probes plus one or two greps. Record where the records are and what they
are about. Phase 5 §5.13 reads the one it needs.

Probe, in this order:

| Source | Signal |
|---|---|
| ADR directories | `docs/adr/**`, `doc/architecture/decisions/**`, `**/adr/**`, `**/decisions/**`, `adr/**` |
| RFC directories | `docs/rfcs/**`, `rfcs/**`, `**/RFC-*.md` |
| Design docs | `docs/design/**`, `docs/architecture/**`, `DESIGN.md`, `ARCHITECTURE.md`, `DECISIONS.md` |
| Security model | `SECURITY.md`, `docs/threat-model*`, `docs/security-model*` |
| Inline markers | one ripgrep for `by design\|deliberate\|intentional\|SECURITY NOTE\|ADR-[0-9]\|see RFC` over source and migration files |

For each **file** hit, read only its first ~15 lines: enough for the title and
a `Status:` / `## Status` line. For each **inline** hit, record `file:line` and
the matched line verbatim. Do not summarise a record you have not read — a
paraphrase of a decision record is worse than a path to it.

Emit at the top level:

```json
{
  "design_records": {
    "detected": true,
    "records": [
      {
        "path": "docs/adr/0007-region-scoping.md",
        "title": "Region scoping is enforced at write, not at read",
        "status": "accepted",
        "topics": ["region scoping", "reconciliation"]
      }
    ],
    "inline_markers": [
      {"file": "db/migrations/0031_rls.sql", "line": 42,
       "text": "-- by design: 'admin' bypasses the region predicate; see ADR-0007"}
    ],
    "evidence": ["docs/adr/", "db/migrations/0031_rls.sql:42"]
  }
}
```

`status` is `accepted` / `proposed` / `superseded` / `unknown`, taken verbatim
from the document. **It is load-bearing.** The Phase-5 burden shift in §5.13
applies only to a record that is *ratified*: a `proposed` ADR argues for an
asymmetry, it does not ratify one, and a `superseded` one ratifies nothing at
all. When no status line exists, `unknown` — do not upgrade a document to
`accepted` because it reads as though someone meant it.

`topics` is a short list of free-text subject keywords lifted from the title
and headings, so a Phase-5 agent can tell in one line whether a record is
plausibly about its finding without opening it.

Absent ⇒ `{"detected": false, "records": [], "inline_markers": []}`.

> **Honest scope, stated plainly because this field can be misused in both
> directions.** A record's *absence* does not make an asymmetry a finding, and
> a record's *presence* does not make one safe. All that changes is who
> carries the burden: with a ratified record naming a compensating control,
> an analyst asserting that the asymmetry **is** the finding must rebut the
> record explicitly (§5.13). This field must never become a blanket dismissal
> — "there's an ADR" is not a refutation, and a refutation of a real defect is
> the most expensive error this skill makes.

## 0.16 — Emit the profile

Write the merged JSON to `.claude-audit/current/phase-00-profile.json` and
the done-marker to `.claude-audit/current/phase-00.done`.

Validate the output against `lib/profile-schema.json` (re-read your JSON to
check every required field is populated or explicitly null).

Report to the user:
> Phase 0 complete — detected <primary language + framework>, <topology
> kind>, <N entities>, LLM usage: <yes/no>, PII: <yes/no>, design records:
> <N>. Proceeding to partition + risk rank.

---

## Verify before exit (MANDATORY)

Before declaring this phase complete and proceeding, run:

```bash
test -f .claude-audit/current/phase-00-profile.json  \
  && test -f .claude-audit/current/phase-00.done \
  && echo "phase-00 verified" \
  || { echo "phase-00 INCOMPLETE — re-write artifact + .done marker before proceeding" >&2; exit 1; }
```

Do not advance to the next phase until this check prints "phase-00 verified". Producing only a downstream artifact (e.g. the final report) without the per-phase artifact + marker is an INVALID run.
