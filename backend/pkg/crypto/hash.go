package crypto

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/bcrypt"
)

const (
	// DefaultBcryptCost is the work factor for bcrypt hashing.
	// OWASP recommends >= 10 for production.
	DefaultBcryptCost = 12

	// SecretKeyLen is the recommended byte length for HMAC secret keys.
	SecretKeyLen = 32
)

// SHA256Hex returns the hex-encoded SHA-256 hash of the input string.
func SHA256Hex(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// SHA256Base64 returns the URL-safe base64-encoded SHA-256 hash of the input.
func SHA256Base64(input string) string {
	h := sha256.Sum256([]byte(input))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

// HMACSHA256 computes an HMAC-SHA256 signature. Returns the hex-encoded result.
// The key should be at least SecretKeyLen bytes long.
func HMACSHA256(message, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyHMACSignature performs a constant-time comparison of an HMAC signature.
// Returns true if the signatures match, preventing timing attacks.
func VerifyHMACSignature(message, key, expectedSignature string) bool {
	actual := HMACSHA256(message, key)
	return ConstantTimeEqualStrings(actual, expectedSignature)
}

// ConstantTimeEqualStrings compares two strings in constant time to prevent
// timing side-channel attacks.
func ConstantTimeEqualStrings(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// HashPassword creates a bcrypt hash of the given password using DefaultBcryptCost.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), DefaultBcryptCost)
	if err != nil {
		return "", fmt.Errorf("bcrypt hash failed: %w", err)
	}
	return string(bytes), nil
}

// CheckPasswordHash verifies that the plain-text password matches the bcrypt hash.
// Returns nil if they match, or an error otherwise (including bcrypt.ErrMismatchedHashAndPassword).
func CheckPasswordHash(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateRandomBytes generates cryptographically secure random bytes of the given length.
func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return nil, fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return b, nil
}

// GenerateRandomHex generates a hex-encoded random string of n bytes (2n hex chars).
func GenerateRandomHex(n int) (string, error) {
	b, err := GenerateRandomBytes(n)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// GenerateRandomBase64 generates a URL-safe base64-encoded random string of n bytes.
func GenerateRandomBase64(n int) (string, error) {
	b, err := GenerateRandomBytes(n)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// MaskSecret masks all but the last 4 characters of a secret for safe logging.
// Example: "supersecretkey" → "**********tkey"
func MaskSecret(secret string) string {
	if len(secret) <= 4 {
		return "****"
	}
	masked := make([]byte, len(secret))
	for i := range masked {
		if i < len(secret)-4 {
			masked[i] = '*'
		} else {
			masked[i] = secret[i]
		}
	}
	return string(masked)
}
