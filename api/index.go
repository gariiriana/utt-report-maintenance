package handler

import (
	"context"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/routes"
)

var handler http.HandlerFunc

func init() {
	ctx := context.Background()
	deps, err := routes.NewAppDeps(ctx)
	if err != nil {
		panic("Failed to initialize dependencies: " + err.Error())
	}
	handler = routes.SetupRouter(deps)
}

func Handler(w http.ResponseWriter, r *http.Request) {
	// Diagnostic endpoint
	if r.URL.Path == "/api/test" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","message":"Root Bridge is working"}`))
		return
	}

	w.Header().Set("X-Backend-Handler", "go-root-bridge")
	if isOptions := middlewares.EnableCORS(w, r); isOptions {
		return
	}

	handler(w, r)
}
