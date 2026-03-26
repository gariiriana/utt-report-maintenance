package handler

import (
	"context"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/logic/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/logic/routes"
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
	w.Header().Set("X-Backend-Handler", "go-bridge-handler")
	if isOptions := middlewares.EnableCORS(w, r); isOptions {
		return
	}

	handler(w, r)
}