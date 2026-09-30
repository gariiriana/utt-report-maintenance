# OWASP Top 10 for Agentic Applications (2026) — Coverage Lens

Companion to `steps/phase-06-config.md §6.17` (spine-level agentic
coverage view). Tag form: `ASI##:2026` (e.g. `ASI01:2026`).

**Edition encoded (verified against `docs/research/03-ai-agentic-mcp.md`
and `docs/research/05-methodology-standards.md`):**

- **OWASP Top 10 for Agentic Applications 2026** — published
  **2025-12-09** by the OWASP GenAI Security Project. **Complementary to**
  (not a replacement for) the OWASP LLM Top 10 2025. The LLM list stays at
  the `LLM##:2025` namespace; the agentic list uses `ASI##:2026`.
  Canonical: `https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/`.

**Relationship to cat-11.** The deep-dive `steps/deepdive/cat-11-mcp-agentic.md`
already emits **per-finding** `ASI##:2026` tags during the cat-11 fan-out.
This file backs the **spine-level coverage view** in §6.17 — a roll-up of
those per-finding tags into an ASI01–ASI10 coverage matrix for Phase 7,
exactly analogous to how §6.10 rolls API-Top-10 and §6.11 rolls LLM-Top-10.
It introduces no new analysis and no fan-out.

---

## ASI01–ASI10 (2026)

| ID | Category | One-line |
|---|---|---|
| **ASI01:2026** | Agent Goal Hijack | Attacker manipulates the agent's objectives / decision pathway, often via indirect prompt injection. |
| **ASI02:2026** | Tool Misuse & Exploitation | A legitimate tool is driven to act unsafely (e.g. unsanitised LLM-generated SQL/shell params). |
| **ASI03:2026** | Identity & Privilege Abuse | Agent escalates via its own identity or inherited tool/service credentials. |
| **ASI04:2026** | Agentic Supply-Chain | Poisoned models, RAG data, tool definitions, or third-party MCP servers. |
| **ASI05:2026** | Unexpected Code Execution (RCE) | Agent induced to generate and run malicious code (code-interpreter sink). |
| **ASI06:2026** | Memory & Context Poisoning | Persistent corruption of vector stores / knowledge graphs / long-term memory. |
| **ASI07:2026** | Insecure Inter-Agent Communication | Interception, forgery, or replay across multi-agent channels. |
| **ASI08:2026** | Cascading Failures | One fault triggers escalating, destructive retries across the agent system. |
| **ASI09:2026** | Human-Agent Trust Exploitation | Fabricated justification tricks a human approver into authorising harm. |
| **ASI10:2026** | Rogue Agents | Autonomous drift / reward-misalignment with no external attacker. |

Design principles introduced alongside the list (for narrative context in
the report): **Least-Agency** (least-privilege extended to autonomy) and
**Strong Observability**; the threat-modelling companion is **MAESTRO**.

---

## CWE crosswalk (for the coverage roll-up)

The cat-11 detections already assign these CWEs (all present in
`lib/cwe-map.json`); §6.17 groups cat-11 findings by their ASI tag:

| ASI | Typical CWE(s) from cat-11 |
|---|---|
| ASI01 | CWE-1427 (prompt injection), CWE-1426 (gen-AI output validation) |
| ASI02 | CWE-269, CWE-77, CWE-78 |
| ASI03 | CWE-668, CWE-863, CWE-269 |
| ASI04 | CWE-78, CWE-829, CWE-306, CWE-346 |
| ASI05 | CWE-78, CWE-77, CWE-94, CWE-502 |
| ASI06 | CWE-829, CWE-20 |
| ASI07 | CWE-319, CWE-345 |
| ASI08 | CWE-862, CWE-770 |
| ASI09 | CWE-862 |
| ASI10 | CWE-269 |

This is a roll-up reference only — cat-11 remains the source of truth for
which specific CWE each finding carries.
