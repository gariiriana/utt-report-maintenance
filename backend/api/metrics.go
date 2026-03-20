package handler

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

var metricsStartTime = time.Now()

// MetricsHandler is the Vercel serverless runtime metrics entry point.
func MetricsHandler(w http.ResponseWriter, r *http.Request) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	w.Header().Set("Cache-Control", "no-store")
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":         "ok",
		"uptime_seconds": time.Since(metricsStartTime).Seconds(),
		"goroutines":     runtime.NumGoroutine(),
		"go_version":     runtime.Version(),
		"num_cpu":        runtime.NumCPU(),
		"alloc_mb":       float64(mem.Alloc) / 1024 / 1024,
		"sys_mb":         float64(mem.Sys) / 1024 / 1024,
		"gc_cycles":      mem.NumGC,
		"timestamp":      time.Now().UTC(),
	})
}
