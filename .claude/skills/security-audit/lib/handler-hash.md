# Handler Hash — Normalization Rules

A `handler_hash` is a content-addressable fingerprint of a surface's handler
body. It is used by delta mode (M6+) to detect semantic changes: if
`handler_hash` is stable across two runs, the handler is treated as
unchanged and its downstream findings are carried over from the baseline.

## Current version — v1 (content-hash)

**Locked decision:** M1-M7 use content hashing. AST hashing is a v2.1
candidate and deliberately out of scope.

### Inputs

- A file path
- A `[start_line, end_line]` range covering the complete handler body
  (opening brace / `def` line to matching close).

### Algorithm

```text
function handler_hash(file, start, end) -> sha1hex:
  lines    = read_lines(file)[start-1 : end]
  body     = join(lines, '\n')
  stripped = strip_comments(body, file_extension)
  squashed = collapse_whitespace(stripped)
  lowered  = lower(squashed)
  return sha1_hex(lowered)
```

### `strip_comments`

Apply the minimum superset of comment forms for the top 5 languages in the
v2 target matrix. Do **not** attempt full lex/parse — a fast textual pass is
sufficient.

| Pattern | Languages |
|---|---|
| `// ...` to end of line | JS/TS/Go/Java/Kotlin/Rust/C#/Swift/PHP |
| `# ...` to end of line | Python/Ruby/Elixir/YAML/Shell/Perl |
| `/* ... */` (non-greedy) | JS/TS/Go/Java/Kotlin/Rust/C#/CSS/PHP |
| `<!-- ... -->` (non-greedy) | HTML/XML/Markdown |

Known false positive: strings containing `//` or `#` get their suffix
stripped (e.g., `"http://example"` → `"http:`). This is acceptable for the
hash because the same string in two runs will be stripped the same way.
Document as a known limitation.

### `collapse_whitespace`

Replace all runs of whitespace (spaces, tabs, newlines, carriage returns)
with a single space. Trim leading / trailing whitespace.

### `lower`

Apply ASCII lowercasing only. Do not apply Unicode case folding (too
expensive and rarely affects correctness).

### `sha1_hex`

SHA-1 of the UTF-8 bytes of the normalized string. SHA-1 is acceptable here
because this is not a security boundary — it is a change-detection
fingerprint. Treat collisions as impossible-in-practice for 40-hex output
over source text.

## Handler body extraction

The caller (Phase 2 sub-agent) is responsible for locating the correct
line range. Rules of thumb:

### Brace-delimited (C-family)

Start at the first `{` on or after the handler signature line; advance to
the matching `}` by tracking nesting depth (ignore braces inside strings
and comments — approximate by skipping quoted regions).

### Indent-delimited (Python)

Start at the line containing `def <name>(...)` (or `async def`) and include
every subsequent line whose indentation is strictly greater than the `def`
line's indentation. Stop at the first line whose indentation is less than
or equal.

### Decorator-based (annotations)

When the handler is identified by an annotation (`@GetMapping`,
`@app.route`, etc.), the body is the annotated function's body, located by
the same rules above.

### File-based routing (Nuxt / Next.js App Router)

The whole file is the handler. Use lines 1..EOF as the range. The file's
default export (or the `GET`/`POST` named exports in App Router) is the
handler body proper, but hashing the whole file is fine for delta purposes.

### Metaprogrammed / dynamic registration

If the handler cannot be located textually (dynamic dispatch, macro
expansion), emit `handler_hash: null` on the surface row and add a note.
Do **not** fabricate a hash.

## Stability goals

- A refactor that reorders independent statements in the body will produce
  a different hash — this is acceptable. (Semantic-equivalent refactors are
  rare in real review flows; a "stale" carry-over is fixed by re-running
  the deep-dive, which is cheap.)
- Adding a logging line will produce a different hash — also acceptable.
  Over-invalidation is preferable to under-invalidation (security-biased
  default).
- Whitespace-only changes (reformatting, trailing-whitespace fixes,
  Windows-vs-Unix newlines) will **not** change the hash. This is the
  primary stability guarantee.
- Comment-only changes will **not** change the hash.

## v2.1 — AST hashing (not now)

A future version will replace content hashing with a lexer-derived token
stream (whitespace, comments, string literals stripped at the AST level).
This reduces over-invalidation but requires per-language parser dependencies
and significant implementation effort. Deferred.
