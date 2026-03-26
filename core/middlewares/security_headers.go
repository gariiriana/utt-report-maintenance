package middlewares

import (
	"fmt"
	"net/http"
)
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-XSS-Protection", "1; mode=block")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Content-Security-Policy", buildCSP())
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		h.Set("Permissions-Policy", buildPermissionsPolicy())
		h.Del("Server")
		h.Del("X-Powered-By")
		if r.URL.Path != "/" && r.URL.Path != "/health" {
			h.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			h.Set("Pragma", "no-cache")
			h.Set("Expires", "0")
		}

		next.ServeHTTP(w, r)
	})
}
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
