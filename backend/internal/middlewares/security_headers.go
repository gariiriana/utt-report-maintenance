package middlewares

import (
	"fmt"
	"net/http"
)

// SecurityHeaders is an HTTP middleware that injects security-hardening HTTP headers
// on every response. These follow OWASP recommendations.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()

		// Prevent clickjacking
		h.Set("X-Frame-Options", "DENY")

		// Enable browser XSS filter (legacy, still useful for older browsers)
		h.Set("X-XSS-Protection", "1; mode=block")

		// Prevent MIME type sniffing
		h.Set("X-Content-Type-Options", "nosniff")

		// Only send the origin as the referrer, not the full URL
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Content Security Policy
		h.Set("Content-Security-Policy", buildCSP())

		// HTTP Strict Transport Security (1 year, include subdomains)
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		// Disable FLoC / interest cohort tracking
		h.Set("Permissions-Policy", buildPermissionsPolicy())

		// Remove server information leakage
		h.Del("Server")
		h.Del("X-Powered-By")

		// Cache-Control for API responses (prevent caching of sensitive data)
		if r.URL.Path != "/" && r.URL.Path != "/health" {
			h.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			h.Set("Pragma", "no-cache")
			h.Set("Expires", "0")
		}

		next.ServeHTTP(w, r)
	})
}

// buildCSP constructs the Content-Security-Policy header value.
func buildCSP() string {
	directives := []string{
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https:",
		"font-src 'self' https://fonts.gstatic.com",
		"connect-src 'self' https://*.googleapis.com https://*.firebase.googleapis.com",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'",
		"upgrade-insecure-requests",
	}
	result := ""
	for i, d := range directives {
		if i > 0 {
			result += "; "
		}
		result += d
	}
	return result
}

// buildPermissionsPolicy constructs the Permissions-Policy header value.
func buildPermissionsPolicy() string {
	policies := map[string]string{
		"geolocation":             "()",
		"camera":                  "()",
		"microphone":              "()",
		"interest-cohort":         "()",
		"payment":                 "()",
		"usb":                     "()",
		"accelerometer":           "()",
		"gyroscope":               "()",
		"magnetometer":            "()",
		"ambient-light-sensor":    "()",
		"autoplay":                "()",
		"fullscreen":              "(self)",
	}
	result := ""
	for feature, allowlist := range policies {
		if result != "" {
			result += ", "
		}
		result += fmt.Sprintf("%s=%s", feature, allowlist)
	}
	return result
}
