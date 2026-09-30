# Deep Dive #5 — Cryptography

**Category.** `crypto`.

**OWASP tags.**
- ASVS: V6 (Stored Cryptography), V2.4 (Credential Storage), V3.5
  (Token-based Session Mgmt — for JWT).
- API Top 10: `API2:2023`.

**Baseline CWEs:** 311, 321, 326, 327, 328, 329, 330, 331, 338, 522, 916.

---

## Invariants

1. No MD5 / SHA1 used for security-relevant operations (passwords,
   signatures, key derivation). Non-security uses (checksums for
   deduplication, git revisions) are fine.
2. Symmetric encryption uses AEAD modes (GCM, ChaCha20-Poly1305) — not
   ECB, not raw CBC without a MAC.
3. No static IV / nonce reuse in symmetric encryption.
4. CSPRNG (`crypto.randomBytes`, `secrets.token_urlsafe`,
   `rand.Read(b)`) is used for security-sensitive randomness — NOT
   `Math.random`, `rand.Intn`, `java.util.Random`.
5. Password hashing meets 2026 OWASP minimums:
   - bcrypt cost ≥12
   - PBKDF2 ≥600,000 iterations (SHA-256), ≥210,000 (SHA-1 legacy)
   - scrypt N ≥2^17 (131072), r=8, p=1
   - Argon2id memory ≥19 MiB, iterations ≥2, parallelism ≥1
6. JWT algorithm is pinned at verification (see also cat-01).
7. No hardcoded keys / salts in source.
8. HMAC for signed-token validation (not a plain hash).
9. Secure random UUIDs for session IDs / tokens (UUIDv4 from secure RNG;
   not UUIDv1 which encodes MAC + timestamp).

## Detection patterns

### Weak hashes

```
crypto\.createHash\s*\(\s*['"](md5|sha1)['"]\s*\)
hashlib\.(md5|sha1)\s*\(
MessageDigest\.getInstance\s*\(\s*"(MD5|SHA-?1)"
Digest::MD5|Digest::SHA1
```

Context: look at the call site.
- If the hash value is used for **password storage / comparison** →
  **HIGH** / **CWE-916** (Use of Password Hash With Insufficient
  Computational Effort — more precise than the generic weak-hash codes).
- If used for other security-sensitive operations (signatures, token
  authentication) → **HIGH** / CWE-327 (broken algorithm) + CWE-328
  (weak hash).

Non-security uses (e.g., ETag generation, cache key derivation) → INFO
only.

### ECB mode

```
AES/ECB|AES-ECB|ECB
Cipher\.getInstance\s*\(\s*"AES/ECB
createCipheriv\s*\(\s*['"]aes-\d+-ecb['"]
```

→ **HIGH** / CWE-327.

### Static IV / nonce

Pattern: `createCipheriv` call with a literal buffer as iv:
```
createCipheriv\s*\([^,]+,\s*[^,]+,\s*(?:['"][A-Fa-f0-9]{16,}['"]\s*|Buffer\.from\s*\(\s*['"][A-Fa-f0-9]{16,}['"])
```

Or `AES-GCM` with a constant `nonce` variable. → **HIGH** / CWE-329.

### Weak PRNG

```
Math\.random\(\)                         # JS
new\s+Random\(\)                         # Java
random\.(random|randint|choice)          # Python (not secrets.*)
rand\.Intn|rand\.Int63                   # Go (not crypto/rand)
srand\(|rand\(\)                         # C/C++
rng\.gen\b                                # Rust (thread_rng; sometimes not CSPRNG)
```

Context: if the value is used for token/session/CSRF/password reset
generation → **CRITICAL** / CWE-338. Else INFO.

### Password hashing work factors

Grep for the hashing setup and check the cost parameter:

```
bcrypt.*\b(\d{1,2})\b                         # cost
PBKDF2.*\b(\d{4,7})\b                          # iteration count
scrypt.*N\s*=\s*(\d+)                          # cost
argon2id.*memory.*\b(\d+)\b                   # MiB
```

Flag under-spec:
- bcrypt cost <12 → **HIGH** / CWE-916
- PBKDF2 <600k (SHA-256) → **HIGH**
- scrypt N <131072 → **HIGH**
- Argon2id memory <19 MiB → **HIGH**

### Hardcoded keys / salts

```
apiKey\s*=\s*['"][A-Za-z0-9_\-]{16,}['"]
jwtSecret\s*=\s*['"][^'"]{8,}['"]
SECRET_KEY\s*=\s*['"][^'"]{8,}['"]
privateKey\s*=\s*'-----BEGIN
```

→ **CRITICAL** / CWE-321 / CWE-798.

Cross-reference with Phase 4 gitleaks output; shared findings get
confidence CONFIRMED.

### UUID generation for tokens

```
uuid\.v1\(|UUID\.version1
```

UUIDv1 encodes MAC address + timestamp. For session IDs this is
**MEDIUM** / CWE-330 (predictable).

### Non-constant-time comparison

Password / token / HMAC comparison via `==` or `===` → **MEDIUM** /
CWE-208 (timing leak). Safe: `crypto.timingSafeEqual`, `hmac.compare_digest`, `MessageDigest.isEqual`.

## False-positive notes

- **Deprecated/legacy systems** may use bcrypt<12 while they migrate.
  Flag but note as "migration-in-progress" possible.
- **Test fixtures** with fake keys like `test-secret-please-ignore` —
  flag anyway, because fixtures sometimes leak into prod.
- **Algorithm strings in enum definitions** (`enum Algorithm { MD5, SHA1 }`) are NOT findings unless the enum values are actually used downstream.

## Output

`phase-05-crypto-<partition>.jsonl`.
