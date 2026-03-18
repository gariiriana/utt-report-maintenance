package handler

import (
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

var mux *http.ServeMux

func init() {
	var err error
	mux, err = routes.SetupRoutes()
	if err != nil {
		panic("Failed to initialize routes: " + err.Error())
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	// Debug header to confirm request reached our Go code
	w.Header().Set("X-Backend-Handler", "go-clean-arch")

	// Enable CORS for all requests at the entry point
	if isOptions := middlewares.EnableCORS(w, r); isOptions {
		return
	}

	mux.ServeHTTP(w, r)
}