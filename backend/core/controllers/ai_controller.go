package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

// AIController handles HTTP requests for AI-powered report generation.
type AIController struct {
	service services.IAIService
}

func NewAIController(service services.IAIService) *AIController {
	return &AIController{service: service}
}

// AnalyzeATSReport handles POST /api/ai/ats-report
// Receives photos from the frontend, sends them to NVIDIA NIM for analysis,
// and returns structured ATS service report data.
func (c *AIController) AnalyzeATSReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.ATSAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if len(req.Photos) == 0 {
		helpers.SendError(w, "At least one photo is required", http.StatusBadRequest)
		return
	}

	if len(req.Photos) > 30 {
		helpers.SendError(w, "Maximum 30 photos allowed per request", http.StatusBadRequest)
		return
	}

	// Validate each photo
	for i, photo := range req.Photos {
		// Default category
		if photo.Category == "" {
			req.Photos[i].Category = "visual_inspection"
		}
	}

	// Call AI service
	result, err := c.service.AnalyzeATSPhotos(r.Context(), req.Photos, req.ReportData)
	if err != nil {
		logger.Error("ai_ats_analyze_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
			"photo_count", len(req.Photos),
		)
		helpers.SendError(w, "AI analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}
