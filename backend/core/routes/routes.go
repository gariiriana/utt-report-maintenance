package routes

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/config"
	"github.com/gariiriana/utt-report-maintenance/backend/core/controllers"
	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type AppDeps struct {
	ReportCtrl  *controllers.ReportController
	AuthCtrl    *controllers.AuthController
	HealthCtrl  *controllers.HealthController
	UserCtrl    *controllers.UserController
	ArchiveCtrl *controllers.ArchiveController
	AuditCtrl   *controllers.AuditController
	MaintenanceProgressCtrl *controllers.MaintenanceProgressController
	FindingCtrl *controllers.FindingController
	RateLimiter      *middlewares.RateLimiter // global catch-all
	ThrottleHeavy    *middlewares.RateLimiter // POST/DELETE — 5 rps, burst 10
	ThrottleStandard *middlewares.RateLimiter // GET lists   — 20 rps, burst 40
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
	maintenanceRepo := repositories.NewMaintenanceProgressRepository(firestoreClient)
	findingRepo := repositories.NewFindingRepository(firestoreClient)
	authSvc    := services.NewAuthService(authClient)
	auditSvc   := services.NewAuditService(auditRepo)
	userSvc    := services.NewUserService(userRepo, authSvc)
	reportSvc  := services.NewReportService(reportRepo)
	archiveSvc := services.NewArchiveService(archiveRepo)
	maintenanceSvc := services.NewMaintenanceProgressService(maintenanceRepo)
	findingSvc := services.NewFindingService(findingRepo)
	notifSvc   := services.NewNotificationService("")
	reportCtrl  := controllers.NewReportController(reportSvc, auditSvc, notifSvc)
	authCtrl    := controllers.NewAuthController(authSvc, userSvc, auditSvc)
	healthCtrl  := controllers.NewHealthController()
	userCtrl    := controllers.NewUserController(userSvc, auditSvc, notifSvc)
	archiveCtrl := controllers.NewArchiveController(archiveSvc)
	auditCtrl   := controllers.NewAuditController(auditSvc)
	maintenanceCtrl := controllers.NewMaintenanceProgressController(maintenanceSvc)
	findingCtrl := controllers.NewFindingController(findingSvc)

	rateLimiter     := middlewares.NewRateLimiter(20, 40)
	throttleHeavy    := middlewares.NewThrottle(5, 10)   // expensive write/delete ops
	throttleStandard := middlewares.NewThrottle(20, 40)  // normal read ops

	return &AppDeps{
		ReportCtrl:  reportCtrl,
		AuthCtrl:    authCtrl,
		HealthCtrl:  healthCtrl,
		UserCtrl:    userCtrl,
		ArchiveCtrl: archiveCtrl,
		AuditCtrl:   auditCtrl,
		MaintenanceProgressCtrl: maintenanceCtrl,
		FindingCtrl: findingCtrl,
		RateLimiter:      rateLimiter,
		ThrottleHeavy:    throttleHeavy,
		ThrottleStandard: throttleStandard,
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
