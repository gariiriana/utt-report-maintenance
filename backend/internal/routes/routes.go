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

// AppDeps holds all initialised dependencies for the application.
type AppDeps struct {
	ReportCtrl  *controllers.ReportController
	AuthCtrl    *controllers.AuthController
	HealthCtrl  *controllers.HealthController
	UserCtrl    *controllers.UserController
	ArchiveCtrl *controllers.ArchiveController
	AuditCtrl   *controllers.AuditController
	RateLimiter *middlewares.RateLimiter
}

// SetupRouter initialises all dependencies and returns the root HTTP handler.
func SetupRouter() (http.HandlerFunc, error) {
	ctx := context.Background()

	// --- Infrastructure ---
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		return nil, err
	}

	authClient, err := config.InitAuthClient(ctx)
	if err != nil {
		return nil, err
	}

	// --- Repositories ---
	reportRepo := repositories.NewReportRepository(firestoreClient)
	userRepo   := repositories.NewUserRepository(firestoreClient)
	auditRepo  := repositories.NewAuditRepository(firestoreClient)
	archiveRepo := repositories.NewArchiveRepository(firestoreClient)

	// --- Services ---
	authSvc    := services.NewAuthService(authClient)
	auditSvc   := services.NewAuditService(auditRepo)
	userSvc    := services.NewUserService(userRepo, authSvc)
	reportSvc  := services.NewReportService(reportRepo)
	archiveSvc := services.NewArchiveService(archiveRepo)
	notifSvc   := services.NewNotificationService("")

	// --- Controllers ---
	reportCtrl  := controllers.NewReportController(reportSvc, auditSvc, notifSvc)
	authCtrl    := controllers.NewAuthController(authSvc, userSvc, auditSvc)
	healthCtrl  := controllers.NewHealthController()
	userCtrl    := controllers.NewUserController(userSvc, auditSvc, notifSvc)
	archiveCtrl := controllers.NewArchiveController(archiveSvc)
	auditCtrl   := controllers.NewAuditController(auditSvc)

	rateLimiter := middlewares.NewRateLimiter(20, 40)

	deps := &AppDeps{
		ReportCtrl:  reportCtrl,
		AuthCtrl:    authCtrl,
		HealthCtrl:  healthCtrl,
		UserCtrl:    userCtrl,
		ArchiveCtrl: archiveCtrl,
		AuditCtrl:   auditCtrl,
		RateLimiter: rateLimiter,
	}

	return buildHandler(deps), nil
}

// buildHandler assembles the main routing function from wired dependencies.
func buildHandler(deps *AppDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Apply middleware stack
		chain := BuildMiddlewareChain(
			middlewares.RequestID,
			middlewares.Logger,
			middlewares.RecoverPanic,
			middlewares.SecurityHeaders,
			middlewares.CORSMiddleware,
			deps.RateLimiter.Middleware,
		)

		chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Validate API secret
			if !middlewares.VerifySecret(r.Header.Get("X-API-Secret")) {
				helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
				return
			}
			RouteRequest(w, r, deps)
		})).ServeHTTP(w, r)
	}
}
