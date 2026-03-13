package middleware

import (
	"net/http"
)

func EnableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	allowedOrigins := map[string]bool{
		"https://report-utt.web.app": true,
		"https://report-utt.firebaseapp.com": true,
		"http://localhost:5173": true,
		"http://localhost:3000": true,
	}

	if allowedOrigins[origin] {
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
