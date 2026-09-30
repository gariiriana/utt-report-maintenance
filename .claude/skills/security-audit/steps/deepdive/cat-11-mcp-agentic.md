# Deep Dive #11 — MCP / Agentic

**Category.** `agentic`.

**Gate.** Only run if `profile.mcp_agentic.detected == true`. This is a
**separate gate** from cat-09's `llm_usage` gate: a repo can be an MCP
server (exposing tools, no user-facing chat) while importing zero LLM
SDK, so cat-09's `llm_usage.detected && kind != "internal"` gate would
wrongly skip it. Phase 0 sets `mcp_agentic.detected` from the sub-check 1
signals (mcp.json / `from mcp` / `@modelcontextprotocol/sdk` / `@*.tool`
/ agent frameworks: langgraph, crewai, autogen, llama-index).

**OWASP tags.** Agentic Applications (2026): `ASI01:2026` Goal Hijack,
`ASI02:2026` Tool Misuse, `ASI03:2026` Identity/Privilege Abuse,
`ASI04:2026` Agentic Supply-Chain, `ASI05:2026` Unexpected Code Exec
(RCE), `ASI06:2026` Memory/Context Poisoning, `ASI07:2026` Insecure
Inter-Agent Comms, `ASI08:2026` Cascading Failures, `ASI09:2026`
Human-Agent Trust Exploitation, `ASI10:2026` Rogue Agents. Overlapping
LLM Top 10 (2025): `LLM01:2025` Prompt Injection, `LLM05:2025` Improper
Output Handling, `LLM06:2025` Excessive Agency.

**Baseline CWEs:** 22, 77, 78, 94, 200, 269, 668, 862, 863, 918, 1426, 1427.

> CVE IDs cited in this file are **class anchors**, not asserted facts —
> verify each against NVD before quoting it in a finding's `sources`
> (cross-ref `lib/known-vuln-versions.md`).

---

## Invariants

1. Model-/user-controlled tool input is never passed unsanitised to a
   shell, `exec`, a path, or an HTTP fetch in a handler.
2. Tool descriptions/docstrings are static literals, not built from env,
   file, or network data (poisoning vector).
3. Untrusted tool RESULTS are not fed back into agent context as trusted
   instructions (indirect prompt injection).
4. An MCP server does not pass the inbound client token through to a
   downstream API (confused deputy; MCP auth spec rev 2025-11-25).
5. Network-exposed MCP servers authenticate and check `Origin`; STDIO
   command/args are never built from external input.
6. Destructive tools require human-in-the-loop; scopes are tool-level
   (least-agency), not one broad grant the agent inherits.

## Detection patterns

### MCP server definitions + tool-scope breadth (ASI04 / ASI02)

Presence ⇒ the repo is an MCP/agent surface → run this category. Config:

```
(^|/)\.?mcp\.json$|claude_desktop_config\.json|(^|/)mcpServers
```

SDK imports (Python, then TS/JS) and tool-registration anchors:

```
^\s*from\s+mcp(\.server)?(\.fastmcp)?\s+import|^\s*import\s+mcp\b|FastMCP\(
@modelcontextprotocol/sdk|new\s+(McpServer|Server)\(|server\.(tool|registerTool)\(|setRequestHandler\(
@mcp\.tool\(|@(\w+)\.tool\(|\.registerTool\(|server\.tool\(\s*['"]
(langgraph|crewai|autogen|llama[_-]?index|AgentExecutor|create_react_agent|initialize_agent)
```

A tool whose name grants broad shell / fs / http / db authority with no
scope/allow-list:

```
['"](run_command|execute_shell|exec|shell|run_sql|raw_query|http_request|fetch_url|read_file|write_file|delete_\w+)['"]
```

→ unscoped broad-authority tool: **HIGH** / CWE-269 / ASI02. Full tool
inventory (count + scope per tool) is **INFO** baseline.

### Prompt injection via tool description / result into agent context (ASI01 / LLM01)

The tool description/docstring is fed to the model verbatim — an
injection sink if interpolated from external data, and the landing zone
for indirect injection when untrusted tool RESULTS return into context.

Description built from runtime/external data (tool poisoning):

```
description\s*[:=]\s*f?["'].*\{.*(env|os\.|fetch|requests\.|input|arg|read|load)
```

→ **HIGH** / CWE-1427 / ASI01,LLM01.

Untrusted tool result returned straight into model context unsanitised:

```
return\s+[^#\n]*\b(requests\.(get|post)|fetch\(|\.read\(|response\.(text|content|body))
(tool_result|observation|tool_output)\s*[:=][^#\n]*\b(html|page|body|content|scrape)\b
```

→ **HIGH** / CWE-1426 / ASI01,LLM01. Imperative smells inside a docstring
(poisoned upstream tool) — manual flag:

```
(ignore (all )?previous|disregard (all )?prior|system:|<important>|do not (tell|inform) the user)
```

→ **MEDIUM** / CWE-1427 / ASI01 (manual confirm).

### Command / arg / path injection inside MCP tool handlers (ASI05)

Inside a `@*.tool` / `server.tool` handler, model-/user-controlled args
into a shell, exec, or path — the `mcp-server-git` class
(CVE-2025-68143/68144/68145, prompt injection → RCE). cat-08
(`injection`) owns the generic sink catalogue; here flag the sink **in a
tool handler**.

```
subprocess\.(run|Popen|call|check_output)\([^)]*shell\s*=\s*True
os\.system\(|os\.popen\(|exec[lv]p?\(
child_process\.(exec|execSync|spawn)\(
```

→ shell from handler arg: **CRITICAL** / CWE-78 / ASI05,LLM05.

```
(subprocess|child_process)[^#\n]*\+\s*(arg|param|input|name|repo|path|cmd)
```

→ argument injection: **HIGH** / CWE-77 / ASI05.

```
(open|Path|os\.path\.join|fs\.(readFile|writeFile|readFileSync))\([^)]*\b(path|repo|file|dir|name)\b
```

→ handler arg in path with no resolve/allow-list (verify no
`realpath`/normalise + prefix check): **HIGH** / CWE-22 / ASI05.

### Confused-deputy / OAuth token pass-through (ASI03)

Per the MCP auth spec (rev **2025-11-25**), a server MUST NOT pass the
inbound client token through to a downstream API, nor accept tokens not
issued for itself. Forwarding the inbound `Authorization` header is a
confused-deputy violation.

```
headers\s*[:=][^#\n]*Authorization[^#\n]*(req\.headers|request\.headers|incoming|ctx\.token|client_token)
(downstream|upstream|forward)[^#\n]*\b(req\.headers\[?['"]?[Aa]uthorization|bearer_token)\b
```

→ **HIGH** / CWE-668 / ASI03. Single long-lived static secret as the only
downstream credential:

```
(API_KEY|ACCESS_TOKEN|PAT|SERVICE_TOKEN)\s*=\s*os\.(getenv|environ)
```

→ static-PAT-only auth (broad blast radius): **MEDIUM** / CWE-862 /
ASI03. Tokens accepted without audience/issuer verification:

```
(verify\s*=\s*False|verify_aud\s*=\s*False|options\s*=\s*\{[^}]*verify_aud[^}]*False)
```

→ missing audience check: **HIGH** / CWE-863 / ASI03.

### Unsafe STDIO / transport config (ASI04 / ASI05)

The 2026-04 systemic class: external input into a STDIO server
command/args spec → arbitrary command execution.

```
StdioServerParameters\([^)]*(command|args)\s*=\s*[^"'\]]*(input|request|os\.environ|argv|sys\.argv)
"command"\s*:\s*[^"]*\$\{|"args"\s*:\s*\[[^\]]*\$\{
```

→ external-input → stdio-command: **CRITICAL** / CWE-78 / ASI04,ASI05.

Network-exposed MCP server, no auth (MCP Inspector class, CVE-2025-49596)
— bound to all interfaces:

```
host\s*=\s*['"]0\.0\.0\.0['"]|listen\(\s*\d+\s*,\s*['"]0\.0\.0\.0['"]
```

→ **HIGH** / CWE-306 / ASI04 (verify no auth + no `Origin` allow-list).
Missing origin validation on HTTP/SSE transport (the **absence** is the
finding):

```
(check_origin|verify_origin|allowed_origins|Origin)\b
```

→ **MEDIUM** / CWE-346 / ASI04 (manual confirm).

### Excessive agency / unscoped tool grants (ASI03 / LLM06)

Autonomy without human-in-the-loop on destructive actions. Auto-approve /
permission-skip switches:

```
auto[_-]?approve|always_?allow|alwaysAllow|yolo|--dangerously-skip-permissions|human_in_the_loop\s*=\s*False
```

→ **HIGH** / CWE-269 / ASI03,LLM06.

Unbounded agent loop (no max-step / no approval gate):

```
(max_iterations|max_steps|recursion_limit)\s*=\s*(None|0|-1)
AgentExecutor\((?![^)]*max_iterations)
```

→ cascading-failure risk: **MEDIUM** / CWE-862 / ASI08. Destructive tool
reachable with no confirmation:

```
['"](delete|drop|transfer|send_email|deploy|wire|purchase|terminate)\w*['"]
```

→ destructive tool without approval gate: **HIGH** / CWE-863 /
ASI03,LLM06 (confirm no approval guard in handler).

### Model-file deserialization (cross-reference only)

Pickle / `torch.load` without `weights_only=True` / `from_pretrained`
with `trust_remote_code=True` is an agentic-supply-chain RCE vector
(ASI04) but is already owned by **cat-08** (CWE-502 deserialization) and
**cat-09** (model supply chain). Do not duplicate — emit at most a
cross-reference **INFO** and let cat-08/cat-09 own the finding.

### Framework version pins (cross-reference)

LangChain core serialization-injection (CVE-2025-68664 / CVE-2025-68665),
MCP Inspector RCE (CVE-2025-49596), `mcp-remote` command injection
(CVE-2025-6514) are version-gated. Consult `lib/known-vuln-versions.md`
for affected ranges, CWE, and severity, scanned against `requirements*.txt`
/ `package-lock.json` / `pnpm-lock.yaml` / `poetry.lock`. Do not hard-code
ranges here — that file is the source of truth.

## This-repo dogfood

These signals apply to **Claude Code skills/agents** in this repo, which
are themselves an agentic surface — audit them as first-class targets:

- `.mcp.json` / `mcpServers` blocks (currently none; flag if added).
- `.claude/settings*.json` permission scopes — an over-broad `allow` list
  is excessive agency (sub-check 6):

  ```
  ['"]allow['"]\s*:\s*\[[^\]]*\b(Bash|WebFetch|Write|Edit)\b
  ```

  → **MEDIUM** / CWE-269 / ASI03.
- `.claude/agents/*` sub-agent prompts that interpolate untrusted repo
  content (file bodies, issue text, diff hunks) into the spawned prompt →
  prompt-injection-into-subagent (sub-check 2): **HIGH** / CWE-1427 /
  ASI01.

## False-positive notes

- **Static description literals** — a `description` interpolating a
  constant or config key (not env/network/user data) is fine; confirm the
  data source before flagging.
- **`0.0.0.0` with auth** — only a finding when no auth middleware **and**
  no origin allow-list is present; behind an authenticating gateway is OK.
- **`shell=True` with a constant command** — only a finding when a tool
  argument reaches the command string.
- **Frameworks in `examples/` / `tests/` / demo notebooks** — not the
  production agent surface; note, don't flag HIGH.
- **`from_pretrained` / `pickle`** — owned by cat-08/cat-09; defer rather
  than double-count.
- **Read-only narrow tools** — a fixed-scope read-only tool is not
  excessive agency.

## Output

`phase-05-agentic-<partition>.jsonl`.
