package handler

import (
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

var handler http.HandlerFunc

func init() {
	var err error
	handler, err = routes.SetupRouter()
	if err != nil {
		panic("Failed to initialize router: " + err.Error())
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	// Debug header to confirm request reached our Go code
	w.Header().Set("X-Backend-Handler", "go-direct-handler")

	// Enable CORS for all requests at the entry point
	if isOptions := middlewares.EnableCORS(w, r); isOptions {
		return
	}

	handler(w, r)
}