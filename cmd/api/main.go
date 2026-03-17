package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gariiriana/utt-report-maintenance/internal/routes"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux, err := routes.SetupRoutes()
	if err != nil {
		log.Fatalf("Failed to initialize routes: %v", err)
	}

	fmt.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
