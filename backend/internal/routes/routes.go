package routes

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/config"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/controllers"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/services"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type AppDeps struct {
	ReportCtrl  *controllers.ReportController
	AuthCtrl    *controllers.AuthController
	HealthCtrl  *controllers.HealthController
	UserCtrl    *controllers.UserController
	ArchiveCtrl *controllers.ArchiveController
	AuditCtrl   *controllers.AuditController
	RateLimiter *middlewares.RateLimiter
}
func NewAppDeps(ctx context.Context) (*AppDeps, error) {
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		return nil, fmt.Errorf("NewAppDeps (firestore): %w", err)
	}

	authClient, err := config.InitAuthClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("NewAppDeps (auth): %w", err)
	}
	reportRepo := repositories.NewReportRepository(firestoreClient)
	userRepo   := repositories.NewUserRepository(firestoreClient)
	auditRepo  := repositories.NewAuditRepository(firestoreClient)
	archiveRepo := repositories.NewArchiveRepository(firestoreClient)
	authSvc    := services.NewAuthService(authClient)
	auditSvc   := services.NewAuditService(auditRepo)
	userSvc    := services.NewUserService(userRepo, authSvc)
	reportSvc  := services.NewReportService(reportRepo)
	archiveSvc := services.NewArchiveService(archiveRepo)
	notifSvc   := services.NewNotificationService("")
	reportCtrl  := controllers.NewReportController(reportSvc, auditSvc, notifSvc)
	authCtrl    := controllers.NewAuthController(authSvc, userSvc, auditSvc)
	healthCtrl  := controllers.NewHealthController()
	userCtrl    := controllers.NewUserController(userSvc, auditSvc, notifSvc)
	archiveCtrl := controllers.NewArchiveController(archiveSvc)
	auditCtrl   := controllers.NewAuditController(auditSvc)

	rateLimiter := middlewares.NewRateLimiter(20, 40)

	return &AppDeps{
		ReportCtrl:  reportCtrl,
		AuthCtrl:    authCtrl,
		HealthCtrl:  healthCtrl,
		UserCtrl:    userCtrl,
		ArchiveCtrl: archiveCtrl,
		AuditCtrl:   auditCtrl,
		RateLimiter: rateLimiter,
	}, nil
}
func SetupRouter(deps *AppDeps) http.HandlerFunc {
	return buildHandler(deps)
}
func buildHandler(deps *AppDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		chain := BuildMiddlewareChain(
			middlewares.RequestID,
			middlewares.Logger,
			middlewares.RecoverPanic,
			middlewares.SecurityHeaders,
			middlewares.CORSMiddleware,
			deps.RateLimiter.Middleware,
		)

		chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !middlewares.VerifySecret(r.Header.Get("X-API-Secret")) {
				helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
				return
			}
			RouteRequest(w, r, deps)
		})).ServeHTTP(w, r)
	}
}
