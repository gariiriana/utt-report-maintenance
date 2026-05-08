package middlewares

import (
	"net/http"
	"os"
	"strings"
)
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
func isAllowedOrigin(origin string) bool {
	allowed := corsAllowedOrigins()
	return allowed["*"] || allowed[origin]
}
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if EnableCORS(w, r) {
			return
		}
		next.ServeHTTP(w, r)
	})
}
func EnableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")

	// SECURITY: Only set ACAO for explicitly allowed origins.
	// If origin is empty or not in the allowlist, do NOT set ACAO header.
	if origin != "" && isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
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
