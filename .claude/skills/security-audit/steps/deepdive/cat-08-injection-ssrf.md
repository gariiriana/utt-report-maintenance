# Deep Dive #8 — Injection / SSRF / Deserialization

**Category.** `injection`.

**OWASP tags.**
- ASVS: V5 (Validation, Sanitization, Encoding), V12.3 (File Resources).
- API Top 10: `API8:2023`, `API10:2023`.

**Baseline CWEs:** 20, 22, 77, 78, 79, 89, 91, 94, 434, 502, 601, 611, 776,
918, 943, 1321.

> **Cross-cutting lens — apply it here.**
> [`lens-availability-integrity.md`](lens-availability-integrity.md). Every
> rule in this file traces attacker-controlled *content* into a dangerous
> sink. The lens traces attacker-controlled **volume** into a bounded consumer
> — well-formed input, valid every time, in a quantity that silently truncates
> something downstream. File its findings under `injection`.

---

## Invariants

1. No SQL built by string concatenation of user input.
2. No NoSQL operators (`$where`, `$regex` with user input) accepted.
3. No OS commands invoked with `shell: true` + user-controlled string.
4. XML parsers harden against XXE (no external entities, no DTDs).
5. Template engines don't render user-controlled templates (SSTI).
6. SSRF defenses in place when HTTP client consumes a user-supplied URL
   (IP allowlist, block IMDS, block loopback / private networks).
7. Unsafe deserializers are not called on untrusted input.
8. File uploads validate extension / MIME type / magic bytes AND strip
   EXIF / dangerous metadata.
9. Redirect `Location` headers target allowlisted hosts.

## Data-flow / taint trace (do this before asserting an injection / SSRF)

CyberGym-E2E's #1 analysis failure is incomplete data-flow tracing
(basis: `docs/research/08-cybergym-e2e.md`). Every category here is a
taint bug: user input is the source, the dangerous call (SQL / NoSQL /
command / template / deserialize / outbound HTTP / redirect) is the sink.
A grep match locates a candidate sink; it does NOT prove the sink is fed
attacker-controlled data. Before flagging, trace the **user-controlled
source -> sink** — from where the value enters (request body / query /
params / header / uploaded file / external message) to the sink call —
across files if validation, the handler, and the sink live apart. Confirm
nothing canonicalizes / parameterizes / allowlists the value on that path.

Calibrate confidence to trace completeness:
- `LIKELY` when the full source->sink path is established by this trace
  alone (a user-controlled value reaches the sink unsanitized). Promote to
  `CONFIRMED` only when a second source (e.g. a scanner — see
  "Cross-reference with scanners") independently agrees — per the Phase-7
  §7.3 rubric a single manual trace is `LIKELY`, not `CONFIRMED`.
- `POSSIBLE` when a sink is found but the taint / source cannot be
  confirmed from the read region (e.g. the argument is a variable whose
  origin lies outside the handler ± ~40 lines you read, or sanitization
  may exist upstream). This matches the locator -> POSSIBLE handling
  already called out for redirect-following SSRF below.

## Detection patterns

### SQL injection

Most scanner hits already land on this. Augment with handler-body greps:

```
# JS/TS (Sequelize/Knex/TypeORM)
query\s*\(\s*`SELECT[\s\S]*?\$\{[^}]+\}
raw\s*\(\s*`[^`]*\$\{
sequelize\.query\s*\(\s*["`'].*\+

# Python (psycopg/SQLAlchemy)
cursor\.execute\s*\(\s*f["']
cursor\.execute\s*\(\s*['"][^'"]*['"]\s*\+
db\.session\.execute\s*\(\s*f["']

# Go
db\.Exec\s*\(\s*fmt\.Sprintf\s*\(

# Java/Kotlin
createStatement\(\)\.executeQuery\s*\(\s*".*"\s*\+
jdbcTemplate\.queryForList\s*\(\s*".*"\s*\+

# PHP
mysqli_query\s*\([^)]*\$_(GET|POST|REQUEST)

# Ruby
where\s*\(\s*"[^"]*#\{[^}]+\}"
ActiveRecord::Base\.connection\.execute\s*\(.*#\{
```

→ **CRITICAL** / CWE-89.

### NoSQL injection

```
# Mongo / Mongoose
find\s*\(\s*\{\s*[^}]*:\s*req\.(body|query|params)\.[^}]+\}
find\s*\(\s*req\.body\s*\)
\$where\s*:\s*['"][^'"]*\$\{
\$regex\s*:\s*req\.
```

→ **HIGH** / CWE-943.

### Command injection

```
# Node
child_process\.(exec|execSync)\s*\(
spawn\s*\([^,]+,\s*[^,]+,\s*\{[^}]*shell\s*:\s*true
execSync\s*\(

# Python
os\.system\s*\(
subprocess\.(run|call|Popen)\s*\([^,]+,\s*shell\s*=\s*True
os\.popen\s*\(

# Go
exec\.Command\s*\(\s*"(sh|bash)"

# PHP
shell_exec|passthru|system|exec\b
backtick string ``...``

# Ruby
`#\{...\}`
system\s*\(.*#\{
Open3\.popen.*shell
```

Check if argument references user input directly → **CRITICAL** /
CWE-77 / CWE-78.

### XXE

```
# Python
etree\.parse\s*\(                    # lxml default is safe post-4.x; verify version
xml\.sax\.make_parser\(\)            # without setFeature for external entities
xml\.dom\.minidom\.parse\s*\(

# Java
DocumentBuilderFactory\.newInstance\(\)   # without setFeature for XXE
SAXParserFactory\.newInstance\(\)          # same

# .NET
new XmlTextReader\s*\(                   # pre-.NET 4.5.2 defaults unsafe
```

Any instance without explicit `setFeature(".../load-external-dtd", false)`
→ **HIGH** / CWE-611.

### SSTI

```
# Jinja2
render_template_string\s*\(\s*(?!['"])
Template\s*\(\s*user_input

# Ruby ERB
ERB\.new\s*\(\s*params\b

# Go html/template
template\.HTML\s*\(\s*userInput
```

User input into template constructor → **CRITICAL** / CWE-94.

### SSRF

For every `outbound_tls` surface in Phase 2 where the URL derives from
user input (`fetch(req.body.url)`, `requests.get(request.args["url"])`),
check for:
- IP allowlist / host allowlist enforcement
- Block for loopback (127.0.0.0/8), link-local (169.254.0.0/16), private
  (RFC1918), IMDS (169.254.169.254), DNS rebinding protection.

Absence → **HIGH** / CWE-918.

#### SSRF validation-method upgrade

2026 SSRF is mostly a *wrong validation method* bug, not just a missing
allowlist. A denylist/allowlist that checks the URL by string or regex
instead of canonicalize-then-classify is bypassable. Flag these:

```
# IPv4-mapped IPv6 form of the IMDS address (string/regex denylists miss it)
::ffff:169\.254\.169\.254
::ffff:a9fe:a9fe

# Alternate IP encodings the denylist must also reject (decimal / octal / hex)
0x[0-9a-fA-F]{8}
0[0-7]{3,}
\b\d{8,10}\b

# A dotted-quad-only gate is bypassable (no hex / octal / IPv6 branch)
\^\\d{1,3}(\\.\\d{1,3}){3}\$
```

→ **HIGH** / CWE-918. Also bypassable by **DNS rebinding** (validate the
hostname, then the HTTP client re-resolves the ORIGINAL hostname at fetch
time — a validate-then-fetch TOCTOU). The robust pattern is
canonicalize-then-classify on the resolved IP:

```
# SAFE shape — classify the parsed/resolved address, not the raw string
ipaddress\.ip_address\([^)]*\)\.is_(private|loopback|link_local)
```

Redirect-following re-opens SSRF after an initial allowlist check — but ONLY
when the request target is user-controlled. A literal-URL call is NOT a
finding. Require a variable first argument (not a string literal) AND redirects
not disabled, and treat it as a **locator → POSSIBLE** pending taint
confirmation, never an automatic HIGH:

```
requests\.(get|post)\(\s*(?!['"])(?![^)]*allow_redirects\s*=\s*False)\w+
```
(The `(?!['"])\w+` requires a variable, not a `"https://..."` literal, which
cuts the false-positive storm on ordinary HTTP calls.)

#### Cloud-metadata denylist completeness

An IMDS blocklist that covers only `169.254.169.254` is INCOMPLETE. A
complete blocklist must reject all of these targets; flag the surface if
any are missing:

```
169\.254\.169\.254
169\.254\.170\.2
fd00:ec2::254
metadata\.google\.internal
100\.100\.100\.200
AWS_CONTAINER_CREDENTIALS_(RELATIVE|FULL)_URI
```

Coverage map: `169.254.169.254` (AWS/Azure/OpenStack IMDS),
`169.254.170.2` (AWS ECS task-role creds), `fd00:ec2::254` (AWS IMDSv6),
`metadata.google.internal` (GCP, served at `169.254.169.254` with a
`Metadata-Flavor: Google` header), `100.100.100.200` (Alibaba Cloud).
Incomplete coverage → **HIGH** / CWE-918.

### Unsafe deserialization

```
# Python
pickle\.loads?\s*\(
cPickle\.loads?\s*\(
yaml\.load\s*\(            # not yaml.safe_load

# JS/TS
JSON\.parse\s*\(\s*.*\)\s*;  # safe by itself; flag only when reviver is a function
node-serialize|serialize-javascript\.unserialize

# Java
ObjectInputStream\s*\([^)]+\)\.readObject\(\)
Marshaller\.unmarshal\b   # JAXB — verify hardened

# .NET
BinaryFormatter\.Deserialize
SoapFormatter\.Deserialize
NetDataContractSerializer

# PHP
unserialize\s*\(          # without allowed_classes

# Ruby
Marshal\.load\s*\(
YAML\.load\s*\(           # not YAML.safe_load
```

All of these on user-controlled data → **CRITICAL** / CWE-502.

#### Deserialization false-safety corrections

These LOOK safe (or are widely assumed safe) but are NOT. Flag them even
when the code reads as hardened — the "safe" knob does not hold.

```
# Python — PyYAML FullLoader is NOT safe (it still constructs arbitrary
# objects). yaml.full_load is the same loader. SAFE: yaml.safe_load /
# Loader=yaml.SafeLoader.
yaml\.load\s*\([^)]*Loader\s*=\s*(yaml\.)?(Full|Unsafe)Loader
yaml\.(full_load|unsafe_load)\s*\(
```

→ **CRITICAL** / CWE-502.

```
# Python — torch.load is bypassable even with weights_only=True on
# torch < 2.10 (malformed pickle opcodes corrupt the restricted
# unpickler). Flag torch.load on any untrusted input REGARDLESS of the
# weights_only flag; recommend safetensors (load_file / safe_open) and
# torch >= 2.10. SAFE only when both hold AND the file is trusted.
torch\.load\s*\(
```

→ **HIGH** / CWE-502. Mitigated only on torch >= 2.10 with
`weights_only=True` AND a trusted source; prefer `safetensors`.

Reaffirm — the base sinks below are unsafe whenever the input is
attacker-influenced, no matter how the call site is framed:

```
# Python / Ruby / .NET / PHP — no "safe mode" exists for these
pickle\.loads?\s*\(
Marshal\.(load|restore)\b
BinaryFormatter\.Deserialize
unserialize\s*\((?![^)]*allowed_classes)
```

→ **CRITICAL** / CWE-502. For PHP `unserialize`, the only safe form is
`unserialize($x, ['allowed_classes' => false])` or an explicit class
allowlist; bare `unserialize(` is unsafe.

### Prototype pollution (JS/TS)

Recursive merge / extend / clone of user-controlled input, or dynamic
property writes keyed on user input, that can reach `Object.prototype`.

```
# Recursive deep-merge / set on user input (lodash & friends)
(_\.|lodash\.)(merge|mergeWith|defaultsDeep|set|setWith)\s*\(
Object\.assign\s*\([^)]*(req|request)\.(body|query|params)
(merge|extend|assign|clone)\s*\([^)]*JSON\.parse

# Danger keys as write targets / paths (strong, specific signal)
\[(['"])(__proto__|constructor|prototype)\1\]
(__proto__|constructor|prototype)\s*:
```

→ **HIGH** / CWE-1321 only when (a) a deep-merge/set takes user input with no
own-property key guard, OR (b) a danger key (`__proto__` / `constructor` /
`prototype`) is a write target. A bare dynamic write (`obj[key] = v`) or a
generic `for…in` copy is NOT flagged on its own — it needs one of the
co-signals above, otherwise it is a false-positive storm. When the polluted
property reaches an HTML / DOM sink, the chain becomes XSS → also tag **CWE-79**.

```
# DOMPurify gadget (pre-3.4 / 3.0.1–3.3.3): the
# CUSTOM_ELEMENT_HANDLING = cfg.X || {} fallback inherits
# Object.prototype, so a PP primitive sets tagNameCheck/attributeNameCheck
# to /.*/ and bypasses default sanitization. Two independent signals:
DOMPurify\.sanitize\s*\(
\|\|\s*\{\}
```

→ **HIGH** / CWE-1321 (chains to **CWE-79**); confirm against
`dompurify` 3.0.1–3.3.3 in the lockfile.

SAFE markers that LOWER severity (note, don't flag HIGH): keys guarded
by `key === '__proto__'` / `constructor` / `prototype` rejection,
`Object.create(null)` maps, `hasOwnProperty.call` checks, or
`Object.freeze(Object.prototype)`.

```
Object\.create\s*\(\s*null\s*\)
hasOwnProperty\.call
```

### File upload

For each `file_upload` surface in Phase 2:
- Check MIME / extension / magic-bytes validation.
- Check destination path is not constructed from user input (path
  traversal / CWE-22).
- Check image files are re-encoded (strip malicious EXIF / polyglot).
- Check upload size limits.

Missing any → **HIGH** / CWE-434 or **HIGH** / CWE-22.

### Open redirect

```
res\.redirect\s*\(\s*req\.(body|query|params)\.
return\s+redirect\s*\(\s*request\.args\.get\s*\(
HttpResponseRedirect\s*\(\s*request\.(GET|POST)\.
```

→ **MEDIUM** / CWE-601.

## Cross-reference with scanners

Most of these already land in semgrep `p/owasp-top-ten` + bandit + psalm.
For each grep match that also appears in a scanner's slim-SARIF, set
`confidence: CONFIRMED`.

## Output

`phase-05-injection-<partition>.jsonl`.
