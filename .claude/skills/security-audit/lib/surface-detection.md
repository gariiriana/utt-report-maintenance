# Surface Detection Catalog

Companion to `steps/phase-02-surface.md §2.3`. One recipe per framework /
surface pair. Each recipe is:

- **Files** — glob patterns to locate candidate files.
- **Pattern** — grep-ready regex to locate the handler registration.
- **Extract** — how to pull `method`, `path`, and the handler reference.
- **Auth hint** — what middleware / decorator to look for in the same file.

Use the Grep tool with `-n` + `multiline: true` where indicated. Normalize
regex to POSIX-extended when invoking via shell, or ripgrep syntax via Grep.

---

## HTTP — JavaScript / TypeScript

### Express / Connect

**Files:** `**/*.{ts,js,mjs,cjs}` excluding `**/*.test.*`, `**/*.spec.*`,
`**/node_modules/**`.

**Pattern:**
```
(app|router|\w+Router)\.(get|post|put|patch|delete|all|use)\s*\(\s*(['"`])([^'"`]+)\3
```

**Extract:** method from group 2 (upper-case), path from group 4. Handler
reference is the last argument (or the function literal immediately after
the path). Multiple handlers in the args are middleware + handler; treat
everything except the final one as middleware candidates.

**Auth hint:** look for `requiresAuth`, `requireAuth`, `authenticate`,
`authMiddleware`, `ensureAuth`, `passport.authenticate(...)` in the same
argument list.

### Fastify

**Pattern:**
```
(fastify|server)\.(get|post|put|patch|delete|all|route)\s*\(\s*(['"`])([^'"`]+)\3
```
Plus object form: `fastify.route({ method: 'GET', url: '/foo', handler: ... })`.

### Hono

**Pattern:** `(app|router)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)`

### Koa (via koa-router)

**Pattern:** `router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)`

### NestJS

**Files:** `**/*.controller.{ts,js}`.
**Pattern:** `@(Get|Post|Put|Patch|Delete|All)\s*\(\s*(?:['"]([^'"]+)['"])?\s*\)`

Class-level `@Controller('/api/x')` prefixes every method inside the class.

### Nuxt / Nitro (file-based)

**Files:** `server/api/**/*.{ts,js,mjs}`, `server/routes/**/*.{ts,js,mjs}`.
**Extract:** filename encodes method + path:
- `server/api/users/[id].get.ts` → `GET /api/users/:id`
- `server/api/users/index.post.ts` → `POST /api/users`
- No `.<method>.` suffix → handles ALL methods (tag `WILDCARD_METHOD`).

### Next.js App Router

**Files:** `app/**/route.{ts,js}`.
**Extract:** path from the directory tree under `app/`; methods from named
exports (`export async function GET`, `POST`, `PUT`, etc.).

### Next.js Pages Router

**Files:** `pages/api/**/*.{ts,js}`.
**Extract:** path from the file path. Method is detected at runtime in the
handler; mark `method: "ANY"` unless explicit `req.method` guards reveal
specific methods.

### tRPC

**Files:** files containing `initTRPC.create()` or `.router({`.
**Pattern:** `\.(query|mutation)\s*\(`
**Extract:** path is the router key chain (e.g., `users.byId`); method is
`query` → GET-equivalent, `mutation` → POST-equivalent.

---

## HTTP — Python

### Django

**Files:** `**/urls.py`, `**/views.py`.
**Pattern (urls.py):** `path\s*\(\s*(['"])([^'"]+)\1\s*,\s*(\w+)`
**Extract:** path from group 2, handler name from group 3. Method inferred
from view class (`class FooView(APIView): def get(self, ...)` → GET).

### DRF

In addition to Django rules, look for `@api_view(['GET', 'POST'])` decorators
and `ViewSet` classes (methods: `list`, `retrieve`, `create`, `update`,
`partial_update`, `destroy` map to GET/GET/POST/PUT/PATCH/DELETE).

### Flask

**Pattern:** `@(?:app|bp)\.route\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]+)\])?`
**Extract:** path from group 1, methods from group 2 (default `['GET']`).

### FastAPI

**Pattern:** `@(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"]([^'"]+)['"]`

Also: `APIRouter(prefix='/foo').get('/bar')` → `/foo/bar`.

### Starlette (raw)

**Pattern:** `Route\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*,\s*methods\s*=\s*\[([^\]]+)\]`

---

## HTTP — Go

### Gin

**Pattern:** `\w+\.(GET|POST|PUT|PATCH|DELETE|Any)\s*\(\s*"([^"]+)"\s*,\s*([\w\.]+)`

### Echo

**Pattern:** `e\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"\s*,\s*(\w+)`

### Chi

**Pattern:** `r\.(Get|Post|Put|Patch|Delete|Connect|Options|Trace)\s*\(\s*"([^"]+)"`

### Fiber

**Pattern:** `app\.(Get|Post|Put|Patch|Delete|All)\s*\(\s*"([^"]+)"`

### net/http stdlib

**Pattern:** `http\.HandleFunc\s*\(\s*"([^"]+)"\s*,\s*(\w+)` and
`mux\.Handle\(\s*"([^"]+)"\s*,\s*(\w+)`

---

## HTTP — Java / Kotlin (Spring MVC / Boot / WebFlux)

**Pattern:** `@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"`

Class-level `@RequestMapping("/api/x")` prefixes. For `@RequestMapping`
without a method, the method is whatever the `method = {RequestMethod.X}`
parameter says; absent that, treat as `ANY` and flag `WILDCARD_METHOD`.

### Ktor

**Pattern:** `(?:get|post|put|patch|delete)\s*\(\s*"([^"]+)"\s*\)\s*\{`

### Micronaut / Quarkus

Same annotations as Spring; same pattern.

---

## HTTP — Ruby

### Rails

**Files:** `config/routes.rb`, `app/controllers/**/*.rb`.
**Pattern (routes.rb):** `resources\s+:(\w+)` → expands to
`index/new/create/show/edit/update/destroy` standard 7 actions.
Also: `get|post|put|patch|delete '<path>', to: 'controller#action'`.

### Sinatra

**Pattern:** `(get|post|put|patch|delete)\s+['"]([^'"]+)['"]\s+do`

---

## HTTP — PHP

### Laravel

**Files:** `routes/*.php`.
**Pattern:** `Route::(get|post|put|patch|delete|any)\s*\(\s*['"]([^'"]+)['"]`

### Symfony

**Pattern:** `#\[Route\s*\(\s*['"]([^'"]+)['"]`

---

## HTTP — .NET

### ASP.NET Core — Minimal APIs

**Pattern:** `app\.(MapGet|MapPost|MapPut|MapPatch|MapDelete|MapMethods)\s*\(\s*"([^"]+)"`

### MVC Controllers

**Pattern:** `\[(Http(Get|Post|Put|Patch|Delete))\s*(\(\s*"([^"]+)"\s*\))?\]`

---

## HTTP — Rust

### Axum

**Pattern:** `\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\s*\(`

### Actix-web

**Pattern:** `\.route\s*\(\s*"([^"]+)"\s*,\s*web::(get|post|put|patch|delete)\s*\(\s*\)\s*\.to\s*\((\w+)\)`
Plus attribute form: `#\[(get|post|put|patch|delete)\s*\(\s*"([^"]+)"`

### Rocket

**Pattern:** `#\[(get|post|put|patch|delete)\s*\(\s*"([^"]+)"`

---

## HTTP — Elixir / Phoenix

**Files:** `lib/<app>_web/router.ex`.
**Pattern:** `(get|post|put|patch|delete)\s+"([^"]+)"\s*,\s*(\w+Controller)\s*,\s*:(\w+)`

---

## HTTP — Scala (Play)

**Files:** `conf/routes`.
**Pattern:** `^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+(\S+)`

---

## gRPC

**Files:** `**/*.proto`.
**Pattern:** `rpc\s+(\w+)\s*\(([^)]+)\)\s+returns\s*\(([^)]+)\)`

Then correlate with server registration:
- Go: `pb.RegisterXxxServer(grpcServer, impl)`.
- Java: `@GrpcService` annotation.
- Python: `add_XxxServicer_to_server(impl, server)`.
- Node: `server.addService(XxxService, impl)`.

---

## GraphQL

**Files:** `**/*.{graphql,gql}`, plus code containing `gql\`...\`` literals.

**Pattern (SDL):** `type\s+Query\s*\{` and `type\s+Mutation\s*\{` — fields
become surfaces.

**Pattern (code-first):**
- JS/TS: `@Resolver` (NestJS), `@Query` / `@Mutation` decorators.
- Python (Strawberry/Graphene): `@strawberry.field`, `class Query:`.
- Java: `@GraphQLQuery`, `@GraphQLMutation` (graphql-java).

---

## WebSocket (inbound server)

- **Node ws:** `new WebSocket.Server({ ... })` / `wss.on('connection', ...)`.
- **Socket.IO:** `io.on('connection', ...)`.
- **NestJS:** `@WebSocketGateway` / `@SubscribeMessage`.
- **Rails ActionCable:** `app/channels/**/*.rb` with `Channel < ApplicationCable::Channel`.
- **Phoenix:** `channel "room:*", MyApp.RoomChannel`.
- **Spring:** `@MessageMapping` in classes annotated `@Controller`.

Emit one surface per `on(...)` event / channel subscription.

---

## SSE (Server-Sent Events)

**Pattern:** files that set header `'Content-Type': 'text/event-stream'` on a
response object, or use `EventSource`-ready Nitro `createEventStream`.

---

## tRPC

Already covered under HTTP section.

---

## Queue Consumers

| Queue | Pattern |
|---|---|
| Kafka | `@KafkaListener`, `new Consumer({topic})`, `kafkajs.consumer` |
| RabbitMQ | `@RabbitListener`, `amqp.consume`, `channel.consume` |
| SQS | `@SqsListener`, `ReceiveMessageCommand`, `SqsClient.receive` |
| NATS | `nc.subscribe`, `nats.subscribe` |
| Redis streams | `xreadgroup`, `XREAD GROUP`, BullMQ `Worker` |
| BullMQ | `new Worker('<queue>', handler)` |
| Sidekiq (Ruby) | `class X < ApplicationJob` or `include Sidekiq::Worker` |
| Celery | `@app.task`, `@shared_task` |

Emit `category: queue_consumer`, `path: <queue/topic>`, `method: null`.

---

## Schedulers

| Scheduler | Pattern |
|---|---|
| Cron (any) | `crontab`, `* * * * *` strings, `schedule.every` |
| Sidekiq-cron | `sidekiq-cron.yml` + `Sidekiq::Cron::Job` |
| BullMQ repeat | `Queue.add(name, data, { repeat: { cron: ... } })` |
| Celery beat | `beat_schedule = { ... }` |
| Hangfire | `RecurringJob.AddOrUpdate` |
| Spring | `@Scheduled(cron = "...")` |
| Nitro | `defineCachedEventHandler` with `schedule` key |
| systemd | `*.timer` unit files |

Emit `path: <cron string>`.

---

## Webhooks

Heuristic combo: HTTP surface + handler reads a signature header
(`X-Hub-Signature`, `Stripe-Signature`, `X-Slack-Signature`, etc.) OR calls a
vendor signature verifier.

Tag with both `category: http` **and** add to webhook list (emit twice is
fine — deduplicate by `id` downstream).

---

## File Uploads

- `multipart/form-data` header handling.
- `multer.single(...)`, `multer.array(...)`, `busboy`.
- `@UploadedFile` (NestJS, Spring).
- `request.FILES` (Django), `ActiveStorage`.
- `formidable`, `express-fileupload`.

Emit `category: file_upload`.

---

## Serverless

| Platform | Signal |
|---|---|
| AWS Lambda | `exports.handler = async (event, context) => ...` + `template.yaml` / `serverless.yml` |
| Azure Functions | `function.json` per function + `async function run(context, req)` |
| GCP Functions | `exports.<name>` + `gcloud functions deploy` in docs |
| CF Workers | `wrangler.jsonc` / `wrangler.toml`, `export default { fetch }` |
| Vercel | `api/` at project root with default exports |
| Netlify | `netlify/functions/*.{ts,js}` |

Emit `category: serverless` with `path` = function name and `method` = event
type (HTTP / queue / scheduled).

---

## Mobile IPC

- **Android**: `AndroidManifest.xml` activities / services / receivers /
  providers with `android:exported="true"`. Path = component class name.
- **iOS**: `CFBundleURLSchemes` in `Info.plist` (URL scheme), or
  `UIApplicationShortcutItems`, or Universal Links in `apple-app-site-association`.

---

## Desktop IPC

- **Electron**: `ipcMain.handle(channel, handler)` and `ipcMain.on(channel, handler)`.
- **Tauri**: `#[tauri::command] fn name(...)` — path = command name.

---

## Admin / Debug

Fixed paths — if the project's HTTP layer serves any of these, emit
`category: admin_debug`:
- `/actuator/**` (Spring Boot)
- `/debug/pprof` (Go)
- `/__debug__` (various)
- `/api-docs`, `/swagger-ui/**`, `/openapi` (OpenAPI docs)
- `/rails/info/**`
- `/django-admin`

---

## CLI Admin / Mgmt Commands

- `bin/*` executables in the repo root or `bin/` directory.
- Rails: `lib/tasks/**/*.rake`.
- Django: `manage.py <command>` and `<app>/management/commands/*.py`.
- Laravel: `app/Console/Commands/*.php`.
- Elixir: `lib/mix/tasks/*.ex`.
- Node: `package.json` `bin` field.

Emit `category: cli_admin`, `path` = command name.

---

## Outbound TLS Clients (for MITM analysis — not an inbound surface)

Track but do **not** inventory as a "surface" in the strictest sense —
Phase 5 category 4 consumes this list.

- Node: `fetch`, `axios.*`, `got`, `node-fetch`, `undici`, `https.request`.
- Python: `requests.get/post/...`, `httpx`, `urllib3`, `aiohttp.ClientSession`.
- Go: `http.Get/Post`, custom `http.Client`, `net/http.DefaultClient`.
- Rust: `reqwest::Client`, `hyper::Client`.
- Java: `HttpClient`, `OkHttpClient`, `RestTemplate`, `WebClient`.
- Ruby: `Net::HTTP`, `HTTParty`, `Faraday`.
- PHP: `curl_init`, `Guzzle\Http\Client`.

Emit `category: outbound_tls`. `path` = the URL or URL-building expression
detected. Many surfaces per repo is expected and normal.
