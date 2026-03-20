package sanitizer

import (
	"html"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"
)

// MaxStringLength is the default maximum allowed string length for sanitized fields.
const MaxStringLength = 4096

var (
	// scriptTagPattern matches <script ...> and </script> tags (case-insensitive).
	scriptTagPattern = regexp.MustCompile(`(?i)<\s*/?script[^>]*>`)

	// htmlTagPattern matches any HTML tag.
	htmlTagPattern = regexp.MustCompile(`<[^>]*>`)

	// sqlInjectionPattern flags common SQL injection tokens.
	sqlInjectionPattern = regexp.MustCompile(`(?i)(--|;|'|"|\/\*|\*\/|xp_|union\s+select|drop\s+table|insert\s+into|select\s+.+\s+from|delete\s+from|update\s+.+\s+set)`)

	// nullBytePattern detects null bytes which can bypass filters.
	nullBytePattern = regexp.MustCompile(`\x00`)

	// controlCharPattern removes non-printable ASCII control characters (except tab/newline/CR).
	controlCharPattern = regexp.MustCompile(`[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]`)
)

// String performs comprehensive sanitization on a single string value:
// - Strips null bytes and control characters
// - Removes HTML tags
// - HTML-escapes remaining special characters
// - Trims leading/trailing whitespace
// - Enforces maximum length
func String(input string) string {
	s := nullBytePattern.ReplaceAllString(input, "")
	s = controlCharPattern.ReplaceAllString(s, "")
	s = scriptTagPattern.ReplaceAllString(s, "")
	s = htmlTagPattern.ReplaceAllString(s, "")
	s = html.EscapeString(s)
	s = strings.TrimSpace(s)

	if utf8.RuneCountInString(s) > MaxStringLength {
		runes := []rune(s)
		s = string(runes[:MaxStringLength])
	}
	return s
}

// StripHTML removes all HTML tags from the input without escaping.
func StripHTML(input string) string {
	s := scriptTagPattern.ReplaceAllString(input, "")
	s = htmlTagPattern.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// HasSQLInjection returns true if the string contains SQL injection patterns.
// Use this to log or reject suspicious inputs.
func HasSQLInjection(input string) bool {
	return sqlInjectionPattern.MatchString(input)
}

// Map sanitizes all string values in a map in-place (shallow, string values only).
// Non-string values are left untouched.
func Map(data map[string]interface{}) map[string]interface{} {
	for k, v := range data {
		if str, ok := v.(string); ok {
			data[k] = String(str)
		} else if nested, ok := v.(map[string]interface{}); ok {
			data[k] = Map(nested)
		}
	}
	return data
}

// SafeURL validates and sanitises a URL string.
// Returns ("", false) if the URL is invalid or uses a non-http(s) scheme.
func SafeURL(rawURL string) (string, bool) {
	rawURL = strings.TrimSpace(rawURL)
	u, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return "", false
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return "", false
	}
	return u.String(), true
}

// AlphanumericOnly removes all non-alphanumeric characters (except hyphens and underscores).
func AlphanumericOnly(input string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_\-]`)
	return re.ReplaceAllString(input, "")
}

// TruncateString truncates a string to maxLen runes, appending "..." if truncated.
func TruncateString(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen-3]) + "..."
}
