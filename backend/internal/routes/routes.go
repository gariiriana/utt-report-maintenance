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

func SetupRouter() (http.HandlerFunc, error) {
	ctx := context.Background()
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		return nil, err
	}

	reportRepo := repositories.NewReportRepository(firestoreClient)
	reportService := services.NewReportService(reportRepo)
	reportController := controllers.NewReportController(reportService)

	return func(w http.ResponseWriter, r *http.Request) {
		// Method Check
		if r.Method != http.MethodPost && r.Method != http.MethodOptions {
			helpers.SendError(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		clientSecret := r.Header.Get("X-API-Secret")
		if !middlewares.VerifySecret(clientSecret) {
			helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
			return
		}

		reportController.HandleReport(w, r)
	}, nil
}
