package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

// DocsHandler is the Vercel serverless API documentation entry point.
// Returns a JSON schema of all available API routes.
func DocsHandler(w http.ResponseWriter, r *http.Request) {
	routeList := routes.Routes()

	type RouteDoc struct {
		Method      string `json:"method"`
		Path        string `json:"path"`
		Description string `json:"description"`
	}

	docs := make([]RouteDoc, 0, len(routeList))
	for _, r := range routeList {
		docs = append(docs, RouteDoc{
			Method:      r.Method,
			Path:        r.Path,
			Description: r.Description,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=600")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"version": "1.0.0",
		"routes":  docs,
		"total":   len(docs),
	})
}
