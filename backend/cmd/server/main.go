package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gariiriana/utt-report-maintenance/api/internal/handlers"
	"github.com/gariiriana/utt-report-maintenance/api/internal/middleware"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	// Handle API routes
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// 1. Enable CORS & Handle OPTIONS
		if isOptions := middleware.EnableCORS(w, r); isOptions {
			return
		}

		// 2. Main Logic
		handlers.ReportHandler(w, r)
	})

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	fmt.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
