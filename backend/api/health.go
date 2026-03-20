package handler

import (
	"net/http"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

// HealthHandler is the Vercel serverless health check entry point.
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC(),
		"service":   "utt-report-maintenance-backend",
	})
}
