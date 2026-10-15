// ============================================================================
// FILE: backend/core/controllers/pm_predictive_controller.go
// Deskripsi: Controller Predictive Report dari laporan Preventive Maintenance.
//            - POST /api/ai/pm-predictive/extract : baca angka/nameplate/kondisi dari
//              foto kartu laporan PM (maks 8 foto per panggilan).
//            - POST /api/ai/pm-predictive/analyze : narasi per equipment (mode
//              "section") atau ringkasan eksekutif (mode "summary").
// ============================================================================

package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
)

const (
	// Batas body fungsi Vercel 4.5 MB; frontend mengompres foto sebelum dikirim.
	pmExtractMaxBody    = 4300 << 10
	pmExtractMaxImage   = 1500 << 10
	pmAnalyzeMaxBody    = 256 << 10
	pmPredictiveTimeout = 55 * time.Second // batas fungsi Vercel 60 detik
)

type PMPredictiveController struct {
	service services.IPMPredictiveService
}

func NewPMPredictiveController(service services.IPMPredictiveService) *PMPredictiveController {
	return &PMPredictiveController{service: service}
}

func validatePMExtractRequest(req services.PMExtractRequest) string {
	if len(req.Items) == 0 || len(req.Items) > services.PMExtractMaxItems {
		return "Jumlah foto per permintaan tidak valid"
	}
	seen := make(map[int]bool, len(req.Items))
	for _, it := range req.Items {
		if seen[it.Index] {
			return "Index foto ganda"
		}
		seen[it.Index] = true
		switch it.Kind {
		case "measurement", "nameplate", "visual":
		default:
			return "Jenis foto tidak dikenal"
		}
		if strings.TrimSpace(it.ImageBase64) == "" {
			return "Foto kosong"
		}
		if len(it.ImageBase64) > pmExtractMaxImage {
			return "Ukuran foto terlalu besar"
		}
		if len(it.Label) > 200 || len(it.Expected) > 300 || len(it.Unit) > 20 {
			return "Keterangan foto terlalu panjang"
		}
	}
	return ""
}

func (c *PMPredictiveController) forbidden(w http.ResponseWriter, r *http.Request) bool {
	if middlewares.RoleFromContext(r.Context()) == "drafter" {
		helpers.SendError(w, "Fitur predictive tidak tersedia untuk Drafter", http.StatusForbidden)
		return true
	}
	return false
}

func (c *PMPredictiveController) sendServiceError(w http.ResponseWriter, r *http.Request, event string, err error) {
	switch {
	case errors.Is(err, services.ErrPMPredictiveNotConfigured):
		helpers.SendError(w, "AI belum aktif: "+err.Error(), http.StatusServiceUnavailable)
	case errors.Is(err, services.ErrMOPRateLimited):
		helpers.SendError(w, err.Error(), http.StatusTooManyRequests)
	default:
		logger.Error(event, "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "AI gagal memproses: "+err.Error(), http.StatusBadGateway)
	}
}

// Extract handles POST /api/ai/pm-predictive/extract
func (c *PMPredictiveController) Extract(w http.ResponseWriter, r *http.Request) {
	if c.forbidden(w, r) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, pmExtractMaxBody)
	var req services.PMExtractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Body permintaan tidak valid atau terlalu besar", http.StatusBadRequest)
		return
	}
	if msg := validatePMExtractRequest(req); msg != "" {
		helpers.SendError(w, msg, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), pmPredictiveTimeout)
	defer cancel()
	items, err := c.service.ExtractReadings(ctx, req)
	if err != nil {
		c.sendServiceError(w, r, "pm_predictive_extract_error", err)
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

// Analyze handles POST /api/ai/pm-predictive/analyze
func (c *PMPredictiveController) Analyze(w http.ResponseWriter, r *http.Request) {
	if c.forbidden(w, r) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, pmAnalyzeMaxBody)
	var req services.PMAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Body permintaan tidak valid atau terlalu besar", http.StatusBadRequest)
		return
	}
	if len(req.Context) == 0 || !json.Valid(req.Context) {
		helpers.SendError(w, "Data analisis kosong", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), pmPredictiveTimeout)
	defer cancel()
	var (
		result interface{}
		err    error
	)
	switch req.Mode {
	case "section":
		result, err = c.service.AnalyzeSection(ctx, req.Context)
	case "summary":
		result, err = c.service.AnalyzeSummary(ctx, req.Context)
	default:
		helpers.SendError(w, "Mode analisis tidak dikenal", http.StatusBadRequest)
		return
	}
	if err != nil {
		c.sendServiceError(w, r, "pm_predictive_analyze_error", err)
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{"result": result})
}
