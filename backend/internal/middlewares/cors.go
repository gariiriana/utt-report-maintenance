package middlewares

import (
	"net/http"
	"os"
	"strings"
)

// corsAllowedOrigins reads the ALLOWED_ORIGINS env variable and returns a set.
func corsAllowedOrigins() map[string]bool {
	raw := os.Getenv("ALLOWED_ORIGINS")
	if raw == "" {
		raw = "http://localhost:3000,http://localhost:5173"
	}
	result := make(map[string]bool)
	for _, o := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			result[trimmed] = true
		}
	}
	return result
}

// isAllowedOrigin returns true if the given origin is on the allowlist.
// A wildcard "*" entry permits all origins.
func isAllowedOrigin(origin string) bool {
	allowed := corsAllowedOrigins()
	return allowed["*"] || allowed[origin]
}

// CORSMiddleware is an http.Handler middleware version of CORS (for middleware chain use).
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if EnableCORS(w, r) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

// EnableCORS handles CORS preflight and sets cross-origin response headers.
// Returns true if the request was a preflight OPTIONS and the caller should stop.
func EnableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")

	if origin != "" && isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else if origin == "" {
		// Non-browser / server-to-server request: allow but don't echo an origin
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}

	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Secret, X-Request-Id, X-Requested-With")
	w.Header().Set("Access-Control-Expose-Headers", "X-Request-Id, X-Backend-Handler")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Max-Age", "86400")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}
