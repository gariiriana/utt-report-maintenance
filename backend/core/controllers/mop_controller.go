// ============================================================================
// FILE: backend/core/controllers/mop_controller.go
// Deskripsi: Controller Bilingual MOP.
//            - POST /api/mop/translate : terjemahkan sebagian segmen dokumen MOP
//              (EN -> ID) dengan layanan AI gratis. Khusus akun dwimitra@co.id
//              & QC DME.
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
	mopMaxSegments       = 1000
	mopMaxSegmentChars   = 5000
	mopMaxDocumentChars  = 300000
	mopMaxIndicesPerCall = 60
	// Batas fungsi Vercel 60 detik; sisakan ruang untuk menulis response.
	mopTranslateTimeout = 55 * time.Second
)

// MOPTranslateRequest: seluruh segmen dokumen (konteks) + index yang diterjemahkan pada panggilan ini.
type MOPTranslateRequest struct {
	Title    string   `json:"title"`
	Segments []string `json:"segments"`
	Indices  []int    `json:"indices"`
}

type MOPController struct {
	service services.IMOPTranslateService
}

func NewMOPController(service services.IMOPTranslateService) *MOPController {
	return &MOPController{service: service}
}

func canUseMOPBilingual(email, role string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	return email == "dwimitra@co.id" || email == "qcdme@dme.com" || role == "qc_dme"
}

func validateMOPTranslateRequest(req MOPTranslateRequest) string {
	if len(req.Segments) == 0 || len(req.Segments) > mopMaxSegments {
		return "Jumlah segmen dokumen tidak valid"
	}
	total := 0
	for _, s := range req.Segments {
		if len(s) > mopMaxSegmentChars {
			return "Ada paragraf yang terlalu panjang"
		}
		total += len(s)
	}
	if total > mopMaxDocumentChars {
		return "Dokumen terlalu besar untuk diterjemahkan sekaligus"
	}
	if len(req.Indices) == 0 || len(req.Indices) > mopMaxIndicesPerCall {
		return "Jumlah segmen per permintaan tidak valid"
	}
	for _, i := range req.Indices {
		if i < 0 || i >= len(req.Segments) {
			return "Index segmen di luar jangkauan"
		}
	}
	return ""
}

// Translate handles POST /api/mop/translate
func (c *MOPController) Translate(w http.ResponseWriter, r *http.Request) {
	if !canUseMOPBilingual(middlewares.EmailFromContext(r.Context()), middlewares.RoleFromContext(r.Context())) {
		helpers.SendError(w, "Fitur Bilingual MOP hanya untuk akun Dwimitra / QC DME", http.StatusForbidden)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	var req MOPTranslateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if msg := validateMOPTranslateRequest(req); msg != "" {
		helpers.SendError(w, msg, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), mopTranslateTimeout)
	defer cancel()

	translations, err := c.service.Translate(ctx, strings.TrimSpace(req.Title), req.Segments, req.Indices)
	if err != nil {
		if errors.Is(err, services.ErrMOPTranslateNotConfigured) {
			helpers.SendError(w, "Penerjemah belum aktif: "+err.Error(), http.StatusServiceUnavailable)
			return
		}
		if errors.Is(err, services.ErrMOPRateLimited) {
			helpers.SendError(w, err.Error(), http.StatusTooManyRequests)
			return
		}
		logger.Error("mop_translate_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
		)
		helpers.SendError(w, "Gagal menerjemahkan: "+err.Error(), http.StatusBadGateway)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"translations": translations,
	})
}
