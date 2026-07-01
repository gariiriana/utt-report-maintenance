package routes

import (
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

func RouteRequest(w http.ResponseWriter, r *http.Request, deps *AppDeps) {
	path := r.URL.Path

	// Convenience aliases
	heavy    := deps.ThrottleHeavy.ThrottleFunc
	standard := deps.ThrottleStandard.ThrottleFunc

	switch {
	// --- Health (no per-route throttle — global rate limiter is enough) ---
	case path == "/health" || path == "/api/health":
		deps.HealthCtrl.Liveness(w, r)

	case path == "/ready" || path == "/api/ready":
		deps.HealthCtrl.Readiness(w, r)

	case path == "/metrics" || path == "/api/metrics":
		deps.HealthCtrl.Metrics(w, r)

	// --- Auth (no extra throttle — global covers it) ---
	case path == "/api/auth/login" && r.Method == http.MethodPost:
		deps.AuthCtrl.Login(w, r)

	case path == "/api/auth/logout" && r.Method == http.MethodPost:
		deps.AuthCtrl.Logout(w, r)

	case path == "/api/auth/me" && r.Method == http.MethodGet:
		deps.AuthCtrl.Me(w, r)

	// --- Reports ---
	case path == "/api/report" && r.Method == http.MethodPost:
		// HEAVY: uploading a report with base64 photos is expensive
		heavy(deps.ReportCtrl.HandleReport)(w, r)

	case path == "/api/reports" && r.Method == http.MethodGet:
		standard(deps.ReportCtrl.ListReports)(w, r)

	case strings.HasPrefix(path, "/api/report/") && r.Method == http.MethodGet:
		standard(deps.ReportCtrl.GetReport)(w, r)

	case strings.HasPrefix(path, "/api/report/") && r.Method == http.MethodDelete:
		heavy(deps.ReportCtrl.DeleteReport)(w, r)

	// --- Users ---
	case path == "/api/users" && r.Method == http.MethodGet:
		standard(deps.UserCtrl.ListUsers)(w, r)

	case strings.HasPrefix(path, "/api/users/") && strings.HasSuffix(path, "/role") && r.Method == http.MethodPatch:
		heavy(deps.UserCtrl.UpdateRole)(w, r)

	case strings.HasPrefix(path, "/api/users/") && r.Method == http.MethodGet:
		standard(deps.UserCtrl.GetProfile)(w, r)

	case strings.HasPrefix(path, "/api/users/") && r.Method == http.MethodDelete:
		heavy(deps.UserCtrl.Deactivate)(w, r)

	// --- Archive ---
	case path == "/api/archive" && r.Method == http.MethodGet:
		standard(deps.ArchiveCtrl.ListArchives)(w, r)

	case strings.HasPrefix(path, "/api/archive/") && r.Method == http.MethodGet:
		standard(deps.ArchiveCtrl.GetArchive)(w, r)

	case strings.HasPrefix(path, "/api/archive/") && r.Method == http.MethodDelete:
		heavy(deps.ArchiveCtrl.PermanentDelete)(w, r)

	// --- Audit ---
	case path == "/api/audit" && r.Method == http.MethodGet:
		standard(deps.AuditCtrl.GetAuditLogs)(w, r)

	case path == "/api/audit/me" && r.Method == http.MethodGet:
		standard(deps.AuditCtrl.GetMyAuditLogs)(w, r)

	// --- Maintenance Progress ---
	// Static routes FIRST to avoid prefix collision
	case path == "/api/maintenance-progress/summary" && r.Method == http.MethodGet:
		standard(deps.MaintenanceProgressCtrl.GetSummary)(w, r)

	case path == "/api/maintenance-progress/end-day" && r.Method == http.MethodPost:
		heavy(deps.MaintenanceProgressCtrl.EndDay)(w, r)

	case path == "/api/maintenance-progress" && r.Method == http.MethodGet:
		standard(deps.MaintenanceProgressCtrl.ListAll)(w, r)

	case path == "/api/maintenance-progress" && r.Method == http.MethodPost:
		heavy(deps.MaintenanceProgressCtrl.CreateProgress)(w, r)

	// Parameterized routes (prefix matches) LAST
	case strings.HasPrefix(path, "/api/maintenance-progress/") && r.Method == http.MethodDelete:
		heavy(deps.MaintenanceProgressCtrl.DeleteProgress)(w, r)

	case strings.HasPrefix(path, "/api/maintenance-progress/") && r.Method == http.MethodPatch:
		heavy(deps.MaintenanceProgressCtrl.UpdateProgress)(w, r)

	// --- AI Service Report ---
	case path == "/api/ai/ats-report" && r.Method == http.MethodPost:
		heavy(deps.AICtrl.AnalyzeATSReport)(w, r)

	case path == "/api/ai/chat" && r.Method == http.MethodPost:
		heavy(deps.AICtrl.Chat)(w, r)

	// --- Findings ---
	case path == "/api/findings" && r.Method == http.MethodPost:
		heavy(deps.FindingCtrl.CreateFinding)(w, r)

	case path == "/api/findings" && r.Method == http.MethodGet:
		standard(deps.FindingCtrl.ListFindings)(w, r)

	case strings.HasPrefix(path, "/api/findings/") && r.Method == http.MethodDelete:
		heavy(deps.FindingCtrl.DeleteFinding)(w, r)

	default:
		helpers.SendError(w, "route not found", http.StatusNotFound)
	}
}
