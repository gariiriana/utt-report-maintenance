package middlewares

import (
	"net/http"
	"strings"
)

func isAllowedOrigin(origin string) bool {
	// Exact matches for production/local
	allowedExact := map[string]bool{
		"https://report-utt.web.app":        true,
		"https://report-utt.firebaseapp.com": true,
		"http://localhost:5173":              true,
		"http://localhost:3000":              true,
	}
	if allowedExact[origin] {
		return true
	}
	// Allow all Firebase Hosting and Vercel preview deployments
	if strings.HasSuffix(origin, ".web.app") ||
		strings.HasSuffix(origin, ".firebaseapp.com") ||
		strings.HasSuffix(origin, ".vercel.app") {
		return true
	}
	return false
}

func EnableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")

	if isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Secret")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}
