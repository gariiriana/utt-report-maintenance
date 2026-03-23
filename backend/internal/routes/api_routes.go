package routes

import (
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
func RouteRequest(w http.ResponseWriter, r *http.Request, deps *AppDeps) {
	path := r.URL.Path

	switch {
	case path == "/health" || path == "/api/health":
		deps.HealthCtrl.Liveness(w, r)

	case path == "/ready" || path == "/api/ready":
		deps.HealthCtrl.Readiness(w, r)

	case path == "/metrics" || path == "/api/metrics":
		deps.HealthCtrl.Metrics(w, r)
	case path == "/api/auth/login" && r.Method == http.MethodPost:
		deps.AuthCtrl.Login(w, r)

	case path == "/api/auth/logout" && r.Method == http.MethodPost:
		deps.AuthCtrl.Logout(w, r)

	case path == "/api/auth/me" && r.Method == http.MethodGet:
		deps.AuthCtrl.Me(w, r)
	case path == "/api/report" && r.Method == http.MethodPost:
		deps.ReportCtrl.HandleReport(w, r)

	case path == "/api/reports" && r.Method == http.MethodGet:
		deps.ReportCtrl.ListReports(w, r)

	case strings.HasPrefix(path, "/api/report/") && r.Method == http.MethodGet:
		deps.ReportCtrl.GetReport(w, r)

	case strings.HasPrefix(path, "/api/report/") && r.Method == http.MethodDelete:
		deps.ReportCtrl.DeleteReport(w, r)
	case path == "/api/users" && r.Method == http.MethodGet:
		deps.UserCtrl.ListUsers(w, r)

	case strings.HasPrefix(path, "/api/users/") && strings.HasSuffix(path, "/role") && r.Method == http.MethodPatch:
		deps.UserCtrl.UpdateRole(w, r)

	case strings.HasPrefix(path, "/api/users/") && r.Method == http.MethodGet:
		deps.UserCtrl.GetProfile(w, r)

	case strings.HasPrefix(path, "/api/users/") && r.Method == http.MethodDelete:
		deps.UserCtrl.Deactivate(w, r)
	case path == "/api/archive" && r.Method == http.MethodGet:
		deps.ArchiveCtrl.ListArchives(w, r)

	case strings.HasPrefix(path, "/api/archive/") && r.Method == http.MethodGet:
		deps.ArchiveCtrl.GetArchive(w, r)

	case strings.HasPrefix(path, "/api/archive/") && r.Method == http.MethodDelete:
		deps.ArchiveCtrl.PermanentDelete(w, r)
	case path == "/api/audit" && r.Method == http.MethodGet:
		deps.AuditCtrl.GetAuditLogs(w, r)

	case path == "/api/audit/me" && r.Method == http.MethodGet:
		deps.AuditCtrl.GetMyAuditLogs(w, r)

	default:
		helpers.SendError(w, "route not found", http.StatusNotFound)
	}
}
