package handler

import (
	"net/http"
	"runtime"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

// VersionInfo holds build-time version metadata.
type VersionInfo struct {
	App       string `json:"app"`
	Version   string `json:"version"`
	GoVersion string `json:"go_version"`
	GOOS      string `json:"goos"`
	GOARCH    string `json:"goarch"`
}

// VersionHandler is the Vercel serverless version info entry point.
func VersionHandler(w http.ResponseWriter, r *http.Request) {
	info := VersionInfo{
		App:       "utt-report-maintenance-backend",
		Version:   "1.0.0",
		GoVersion: runtime.Version(),
		GOOS:      runtime.GOOS,
		GOARCH:    runtime.GOARCH,
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok",
		"data":   info,
	})
}
