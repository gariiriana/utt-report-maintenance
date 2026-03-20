package controllers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

var startTime = time.Now()

// HealthController provides liveness and readiness endpoints.
type HealthController struct{}

// NewHealthController constructs a HealthController.
func NewHealthController() *HealthController {
	return &HealthController{}
}

// Liveness handles GET /health — returns 200 if the process is running.
func (c *HealthController) Liveness(w http.ResponseWriter, r *http.Request) {
	helpers.SendJSON(w, http.StatusOK, models.HealthStatus{
		Status:    "ok",
		Timestamp: time.Now().UTC(),
	})
}

// Readiness handles GET /ready — returns 200 if the service is ready to handle requests.
// In a more complete implementation, this would check DB connectivity etc.
func (c *HealthController) Readiness(w http.ResponseWriter, r *http.Request) {
	checks := map[string]string{
		"process":  "ok",
		"goroutines": "ok",
	}
	if runtime.NumGoroutine() > 10000 {
		checks["goroutines"] = "warning: high goroutine count"
	}

	helpers.SendJSON(w, http.StatusOK, models.HealthStatus{
		Status:    "ok",
		Timestamp: time.Now().UTC(),
		Checks:    checks,
	})
}

// Metrics handles GET /metrics — returns basic runtime metrics.
func (c *HealthController) Metrics(w http.ResponseWriter, r *http.Request) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"uptime_seconds":  time.Since(startTime).Seconds(),
		"goroutines":      runtime.NumGoroutine(),
		"go_version":      runtime.Version(),
		"num_cpu":         runtime.NumCPU(),
		"alloc_mb":        float64(mem.Alloc) / 1024 / 1024,
		"total_alloc_mb":  float64(mem.TotalAlloc) / 1024 / 1024,
		"sys_mb":          float64(mem.Sys) / 1024 / 1024,
		"gc_cycles":       mem.NumGC,
		"timestamp":       time.Now().UTC(),
	})
}
