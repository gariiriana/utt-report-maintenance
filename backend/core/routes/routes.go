package routes

import (
	"context"
	"fmt"
	"net/http"

	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/gariiriana/DwimitraSystem/backend/core/config"
	"github.com/gariiriana/DwimitraSystem/backend/core/controllers"
	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/repositories"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
)

type AppDeps struct {
	ReportCtrl              *controllers.ReportController
	AuthCtrl                *controllers.AuthController
	HealthCtrl              *controllers.HealthController
	UserCtrl                *controllers.UserController
	ArchiveCtrl             *controllers.ArchiveController
	AuditCtrl               *controllers.AuditController
	MaintenanceProgressCtrl *controllers.MaintenanceProgressController
	FindingCtrl             *controllers.FindingController
	AICtrl                  *controllers.AIController
	VoiceCtrl               *controllers.VoiceController
	RateLimiter             *middlewares.RateLimiter // global catch-all
	ThrottleHeavy           *middlewares.RateLimiter // POST/DELETE — 5 rps, burst 10
	ThrottleStandard        *middlewares.RateLimiter // GET lists   — 20 rps, burst 40
	AuthClient              *firebaseAuth.Client    // Firebase Auth client for token verification
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
	userRepo := repositories.NewUserRepository(firestoreClient)
	auditRepo := repositories.NewAuditRepository(firestoreClient)
	archiveRepo := repositories.NewArchiveRepository(firestoreClient)
	maintenanceRepo := repositories.NewMaintenanceProgressRepository(firestoreClient)
	findingRepo := repositories.NewFindingRepository(firestoreClient)
	authSvc := services.NewAuthService(authClient)
	auditSvc := services.NewAuditService(auditRepo)
	userSvc := services.NewUserService(userRepo, authSvc)
	reportSvc := services.NewReportService(reportRepo)
	archiveSvc := services.NewArchiveService(archiveRepo)
	maintenanceSvc := services.NewMaintenanceProgressService(maintenanceRepo)
	findingSvc := services.NewFindingService(findingRepo)
	notifSvc := services.NewNotificationService("")
	reportCtrl := controllers.NewReportController(reportSvc, auditSvc, notifSvc)
	authCtrl := controllers.NewAuthController(authSvc, userSvc, auditSvc)
	healthCtrl := controllers.NewHealthController()
	userCtrl := controllers.NewUserController(userSvc, auditSvc, notifSvc)
	archiveCtrl := controllers.NewArchiveController(archiveSvc)
	auditCtrl := controllers.NewAuditController(auditSvc)
	maintenanceCtrl := controllers.NewMaintenanceProgressController(maintenanceSvc)
	findingCtrl := controllers.NewFindingController(findingSvc)
	aiSvc := services.NewAIService(firestoreClient)
	aiCtrl := controllers.NewAIController(aiSvc)
	voiceSvc := services.NewVoiceService(firestoreClient)
	voiceCtrl := controllers.NewVoiceController(voiceSvc)

	rateLimiter := middlewares.NewRateLimiter(20, 40)
	throttleHeavy := middlewares.NewThrottle(5, 10)   // expensive write/delete ops
	throttleStandard := middlewares.NewThrottle(20, 40) // normal read ops

	return &AppDeps{
		ReportCtrl:              reportCtrl,
		AuthCtrl:                authCtrl,
		HealthCtrl:              healthCtrl,
		UserCtrl:                userCtrl,
		ArchiveCtrl:             archiveCtrl,
		AuditCtrl:               auditCtrl,
		MaintenanceProgressCtrl: maintenanceCtrl,
		FindingCtrl:             findingCtrl,
		AICtrl:                  aiCtrl,
		VoiceCtrl:               voiceCtrl,
		RateLimiter:             rateLimiter,
		ThrottleHeavy:           throttleHeavy,
		ThrottleStandard:        throttleStandard,
		AuthClient:              authClient,
	}, nil
}

func SetupRouter(deps *AppDeps) http.HandlerFunc {
	return buildHandler(deps)
}

// buildHandler creates the main HTTP handler with dual-auth support.
// SECURITY: Accepts either Firebase Auth token (Authorization: Bearer <token>)
// OR the legacy X-API-Secret header. Firebase Auth is preferred.
// Health/ready/metrics endpoints are unauthenticated.
func buildHandler(deps *AppDeps) http.HandlerFunc {
	firebaseAuthMw := middlewares.RequireFirebaseAuth(deps.AuthClient)

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
			path := r.URL.Path

			// Health/ready/metrics: no auth required
			if path == "/health" || path == "/api/health" ||
				path == "/ready" || path == "/api/ready" ||
				path == "/metrics" || path == "/api/metrics" {
				RouteRequest(w, r, deps)
				return
			}

			// WebSocket: auth via query parameter (browsers can't set headers on WS upgrade)
			if path == "/api/voice/ws" {
				token := r.URL.Query().Get("token")
				if token != "" {
					// Verify the Firebase ID token from query param
					decoded, err := deps.AuthClient.VerifyIDToken(r.Context(), token)
					if err == nil {
						ctx := r.Context()
						ctx = context.WithValue(ctx, middlewares.ClaimsKeyExported, decoded)
						ctx = context.WithValue(ctx, middlewares.UserUIDKeyExported, decoded.UID)
						if email, ok := decoded.Claims["email"].(string); ok {
							ctx = context.WithValue(ctx, middlewares.UserEmailKeyExported, email)
						}
						if role, ok := decoded.Claims["role"].(string); ok {
							ctx = context.WithValue(ctx, middlewares.UserRoleKeyExported, role)
						}
						RouteRequest(w, r.WithContext(ctx), deps)
						return
					}
				}
				// Fallback: try standard Authorization header
			}

			// AUTHENTICATION: Enforce Firebase ID Token verification
			// All protected routes MUST provide a valid Bearer token.
			// Legacy X-API-Secret is no longer supported for security consistency.
			firebaseAuthMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				RouteRequest(w, r, deps)
			})).ServeHTTP(w, r)
		})).ServeHTTP(w, r)
	}
}
