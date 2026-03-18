package routes

import (
	"context"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/config"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/controllers"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/services"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

func SetupRoutes() (*http.ServeMux, error) {
	mux := http.NewServeMux()

	ctx := context.Background()
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		return nil, err
	}

	reportRepo := repositories.NewReportRepository(firestoreClient)
	reportService := services.NewReportService(reportRepo)
	reportController := controllers.NewReportController(reportService)

	apiHandler := func(w http.ResponseWriter, r *http.Request) {
		clientSecret := r.Header.Get("X-API-Secret")

		if !middlewares.VerifySecret(clientSecret) {
			helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
			return
		}

		reportController.HandleReport(w, r)
	}

	// Use catch-all since Vercel already routes targeted requests here
	mux.HandleFunc("/", apiHandler)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK Clean Architecture App"))
	})

	return mux, nil
}
