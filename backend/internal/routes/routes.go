package routes

import (
	"context"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/api/internal/config"
	"github.com/gariiriana/utt-report-maintenance/api/internal/controllers"
	"github.com/gariiriana/utt-report-maintenance/api/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/api/internal/repositories"
	"github.com/gariiriana/utt-report-maintenance/api/internal/services"
	"github.com/gariiriana/utt-report-maintenance/api/pkg/helpers"
)

func SetupRoutes() (*http.ServeMux, error) {
	mux := http.NewServeMux()

	// 1. Initialize DB
	ctx := context.Background()
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		return nil, err
	}

	// 2. Initialize Repositories, Services, Controllers
	reportRepo := repositories.NewReportRepository(firestoreClient)
	reportService := services.NewReportService(reportRepo)
	reportController := controllers.NewReportController(reportService)

	// 3. Define Routes
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// Middleware: CORS
		if isOptions := middlewares.EnableCORS(w, r); isOptions {
			return
		}

		// Middleware: Auth
		clientSecret := r.Header.Get("X-API-Secret")
		if !middlewares.VerifySecret(clientSecret) {
			helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
			return
		}

		// Controller action
		reportController.HandleReport(w, r)
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK Clean Architecture App"))
	})

	return mux, nil
}
