package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	handler, err := routes.SetupRouter()
	if err != nil {
		log.Fatalf("Failed to initialize router: %v", err)
	}

	fmt.Printf("Server starting at :%s...\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}
