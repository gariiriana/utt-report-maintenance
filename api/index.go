package handler

import (
	"context"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/routes"
	"sync"
)

var (
	handler     http.HandlerFunc
	initOnce    sync.Once
	initError   error
)

func initialize() {
	initOnce.Do(func() {
		ctx := context.Background()
		deps, err := routes.NewAppDeps(ctx)
		if err != nil {
			initError = err
			return
		}
		handler = routes.SetupRouter(deps)
	})
}

func Handler(w http.ResponseWriter, r *http.Request) {
	initialize()
	if initError != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"error","message":"Service Initialization Failed","error":"` + initError.Error() + `"}`))
		return
	}
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
