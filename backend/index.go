package handler

import (
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/api/internal/handlers"
	"github.com/gariiriana/utt-report-maintenance/api/internal/middleware"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	// 1. Enable CORS & Handle OPTIONS
	if isOptions := middleware.EnableCORS(w, r); isOptions {
		return
	}

	// 2. Main Logic
	handlers.ReportHandler(w, r)
}
