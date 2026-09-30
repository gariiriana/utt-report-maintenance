# Deep Dive #4 — MITM / Transport

**Category.** `mitm`.

**OWASP tags.**
- ASVS: V9 (Communications), V14 (Configuration).
- API Top 10: `API8:2023` (Security Misconfiguration).

**Baseline CWEs:** 295, 297, 319, 923.

---

## Invariants to verify

1. No production code path disables certificate verification.
2. TLS minimum version is ≥1.2 (ideally 1.3) wherever configurable.
3. Hostname verification is enabled on all HTTP clients.
4. Redirect-followers don't auto-downgrade from HTTPS → HTTP.
5. Mobile apps use certificate pinning for API traffic (not public CAs
   only) on release builds.
6. Outbound WebSocket / gRPC clients use TLS (`wss://`, TLS transport
   credentials).

## Detection patterns (per language)

### Node / JS / TS

```
rejectUnauthorized\s*:\s*false
NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?
agentOptions\s*:\s*\{[^}]*rejectUnauthorized\s*:\s*false
new\s+https\.Agent\s*\([^)]*rejectUnauthorized\s*:\s*false
```

Any match is **CRITICAL** in production code / **HIGH** in tests (but the
finding is: the same config can leak into prod via env flag).

### Python

```
verify\s*=\s*False                # requests
ssl\._create_unverified_context
urllib3\.disable_warnings\(urllib3\.exceptions\.InsecureRequestWarning\)
session\.verify\s*=\s*False
```

→ **CRITICAL** / CWE-295.

### Go

```
InsecureSkipVerify\s*:\s*true
tls\.Config\s*\{[^}]*InsecureSkipVerify\s*:\s*true
```

→ **CRITICAL** / CWE-295. Do not exclude test files — the same config
pattern copies into production.

### Java / Kotlin

```
AllowAllHostnameVerifier
HostnameVerifier\s*\{\s*return\s+true
X509TrustManager.*\s*\{[^}]*return\s*true
trustAllCerts
new\s+NoopHostnameVerifier
```

→ **CRITICAL** / CWE-297.

### PHP

```
CURLOPT_SSL_VERIFYPEER\s*=>\s*false
CURLOPT_SSL_VERIFYHOST\s*=>\s*(?:false|0)
```

→ **CRITICAL** / CWE-295.

### .NET

```
ServicePointManager\.ServerCertificateValidationCallback\s*=\s*\([^)]*\)\s*=>\s*true
HttpClientHandler\s*\{\s*ServerCertificateCustomValidationCallback\s*=\s*\([^)]*\)\s*=>\s*true
```

→ **CRITICAL** / CWE-295.

### Ruby

```
OpenSSL::SSL::VERIFY_NONE
verify_mode\s*=\s*OpenSSL::SSL::VERIFY_NONE
```

→ **CRITICAL** / CWE-295.

### Rust

```
danger_accept_invalid_certs\s*\(\s*true
danger_accept_invalid_hostnames\s*\(\s*true
```

→ **CRITICAL** / CWE-295.

## TLS version

Grep for `TLSv1\.0|TLSv1\.1|SSLv[23]|SSLv3|\"SSLv3\"` — any explicit
reference to TLS <1.2 is **HIGH** / CWE-327.

## Outbound WebSocket / gRPC

For every `outbound_tls` surface in Phase 2 whose URL starts with `ws://`
(not `wss://`) or a gRPC client with `grpc.insecure()`, flag → **HIGH** /
CWE-319.

## Mobile pinning

If `profile.surfaces_hint.mobile` is non-empty:
- Android: look for `network_security_config.xml` with
  `<pin-set>`; absence on release → **MEDIUM** / CWE-295.
- iOS: look for ATS exceptions (`NSAllowsArbitraryLoads = true` in
  `Info.plist`) → **HIGH** / CWE-319.

## False-positive notes

- `InsecureSkipVerify: true` inside `_test.go` is borderline. Flag at
  LOW severity if it's clearly in tests; escalate to HIGH if it's behind
  a feature flag that can be toggled at runtime.
- Internal cluster traffic with mTLS may legitimately use
  `InsecureSkipVerify` after cert-pinning via `tls.Config.RootCAs`.
  Verify before flagging.
- Development fixtures (`localhost` TLS cert generation scripts) are fine
  to ignore if never imported by prod code.

## Output

`phase-05-mitm-<partition>.jsonl`.
