package sanitizer

import (
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"
)
const MaxStringLength = 4096

var (
	scriptTagPattern = regexp.MustCompile(`(?i)<\s*/?script[^>]*>`)
	htmlTagPattern = regexp.MustCompile(`<[^>]*>`)
	sqlInjectionPattern = regexp.MustCompile(`(?i)(--|;|'|"|\/\*|\*\/|xp_|union\s+select|drop\s+table|insert\s+into|select\s+.+\s+from|delete\s+from|update\s+.+\s+set)`)
	nullBytePattern = regexp.MustCompile(`\x00`)
	controlCharPattern = regexp.MustCompile(`[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]`)
)
func String(input string) string {
	s := nullBytePattern.ReplaceAllString(input, "")
	s = controlCharPattern.ReplaceAllString(s, "")
	s = scriptTagPattern.ReplaceAllString(s, "")
	s = htmlTagPattern.ReplaceAllString(s, "")
	s = strings.TrimSpace(s)

	if utf8.RuneCountInString(s) > MaxStringLength {
		runes := []rune(s)
		s = string(runes[:MaxStringLength])
	}
	return s
}
func StripHTML(input string) string {
	s := scriptTagPattern.ReplaceAllString(input, "")
	s = htmlTagPattern.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}
func HasSQLInjection(input string) bool {
	return sqlInjectionPattern.MatchString(input)
}
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
func AlphanumericOnly(input string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_\-]`)
	return re.ReplaceAllString(input, "")
}
func TruncateString(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen-3]) + "..."
}
