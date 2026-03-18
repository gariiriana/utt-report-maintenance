package middlewares

import (
	"net/http"
)

func isAllowedOrigin(origin string) bool {
	return true // Allow all for now to definitively solve CORS
}

func EnableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")

	// If origin is empty, it might not be a cross-origin request
	// But for preflight, we always want to be permissive if it matches our pattern
	if origin != "" && isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else if origin == "" {
		// Fallback for non-browser or direct requests
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}

	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Secret, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}
