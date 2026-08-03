package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
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
	if len(req.Photos) == 0 && req.ReportData == nil {
		helpers.SendError(w, "At least one photo or report data is required", http.StatusBadRequest)
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

// AnalyzeFCUReport handles POST /api/ai/fcu-report
// Receives photos from the frontend and returns structured FCU service report data.
func (c *AIController) AnalyzeFCUReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.FCUAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Photos) == 0 && req.ReportData == nil {
		helpers.SendError(w, "At least one photo or report data is required", http.StatusBadRequest)
		return
	}

	if len(req.Photos) > 30 {
		helpers.SendError(w, "Maximum 30 photos allowed per request", http.StatusBadRequest)
		return
	}

	for i, photo := range req.Photos {
		if photo.Category == "" {
			req.Photos[i].Category = "visual_inspection"
		}
	}

	result, err := c.service.AnalyzeFCUPhotos(r.Context(), req.Photos, req.ReportData)
	if err != nil {
		logger.Error("ai_fcu_analyze_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
			"photo_count", len(req.Photos),
		)
		helpers.SendError(w, "AI FCU analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzePJUReport handles POST /api/ai/pju-report
// Receives photos from the frontend and returns structured PJU service report data.
func (c *AIController) AnalyzePJUReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.PJUAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Photos) == 0 && req.ReportData == nil {
		helpers.SendError(w, "At least one photo or report data is required", http.StatusBadRequest)
		return
	}

	if len(req.Photos) > 30 {
		helpers.SendError(w, "Maximum 30 photos allowed per request", http.StatusBadRequest)
		return
	}

	for i, photo := range req.Photos {
		if photo.Category == "" {
			req.Photos[i].Category = "visual_inspection"
		}
	}

	result, err := c.service.AnalyzePJUPhotos(r.Context(), req.Photos, req.ReportData)
	if err != nil {
		logger.Error("ai_pju_analyze_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
			"photo_count", len(req.Photos),
		)
		helpers.SendError(w, "AI PJU analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// Chat handles POST /api/ai/chat
func (c *AIController) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Messages) == 0 {
		helpers.SendError(w, "Messages cannot be empty", http.StatusBadRequest)
		return
	}

	// Call AI service
	reply, err := c.service.Chat(r.Context(), req.Messages)
	if err != nil {
		logger.Error("ai_chat_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
		)
		helpers.SendError(w, "AI chat failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]string{
		"reply": reply,
	})
}

// ValidateATSForm handles POST /api/ai/validate-form
func (c *AIController) ValidateATSForm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.FormValidationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Call AI service to validate
	result, err := c.service.ValidateATSForm(r.Context(), req.ReportData, req.Photos)
	if err != nil {
		logger.Error("ai_ats_validate_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
		)
		helpers.SendError(w, "AI validation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeSingleCard handles POST /api/ai/analyze-card
func (c *AIController) AnalyzeSingleCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.CardAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.PhotoBase64 == "" {
		helpers.SendError(w, "Photo base64 is required", http.StatusBadRequest)
		return
	}

	// Call AI service
	result, err := c.service.AnalyzeSingleCard(r.Context(), req)
	if err != nil {
		logger.Error("ai_ats_analyze_card_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
		)
		helpers.SendError(w, "AI card analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzePDUReport handles POST /api/ai/pdu-report
func (c *AIController) AnalyzePDUReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.PDUAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzePDUPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_pdu_report_error",
			"request_id", helpers.ExtractRequestID(r),
			"error", err.Error(),
		)
		helpers.SendError(w, "AI PDU report generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeCTReport handles POST /api/ai/ct-report
func (c *AIController) AnalyzeCTReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.CTAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeCTPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_ct_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI CT analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeGeneratorReport handles POST /api/ai/generator-report
func (c *AIController) AnalyzeGeneratorReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.GeneratorAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeGeneratorPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_generator_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Generator analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeTrafoReport handles POST /api/ai/trafo-report
func (c *AIController) AnalyzeTrafoReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.TrafoAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeTrafoPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_trafo_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Trafo analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeACSplitReport handles POST /api/ai/acsplit-report
func (c *AIController) AnalyzeACSplitReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.ACSplitAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeACSplitPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_acsplit_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI AC Split analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeBusductReport handles POST /api/ai/busduct-report
func (c *AIController) AnalyzeBusductReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.BusductAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeBusductPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_busduct_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Busduct analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeDocklevelerReport handles POST /api/ai/dockleveler-report
func (c *AIController) AnalyzeDocklevelerReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.DocklevelerAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeDocklevelerPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_dockleveler_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Dock Leveler analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeDoorReport handles POST /api/ai/door-report
func (c *AIController) AnalyzeDoorReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.DoorAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeDoorPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_door_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Door analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeCapacitorbankReport handles POST /api/ai/capacitorbank-report
func (c *AIController) AnalyzeCapacitorbankReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.CapacitorbankAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeCapacitorbankPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_capacitorbank_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Capacitor Bank analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// AnalyzeLdbrdbReport handles POST /api/ai/ldbrdb-report
func (c *AIController) AnalyzeLdbrdbReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.LdbrdbAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.service.AnalyzeLdbrdbPhotos(r.Context(), req.Photos, req.ExistingData)
	if err != nil {
		logger.Error("ai_ldbrdb_analyze_error", "error", err.Error())
		helpers.SendError(w, "AI Panel LDB & RDB analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}

// DigitizePaperReport handles POST /api/ai/digitize-paper-report
func (c *AIController) DigitizePaperReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.PaperReportScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.Photos) == 0 {
		helpers.SendError(w, "At least one photo is required for paper scanning", http.StatusBadRequest)
		return
	}

	result, err := c.service.DigitizePaperReport(r.Context(), req.Photos, req.AccountEmail)
	if err != nil {
		logger.Error("ai_digitize_paper_report_error", "error", err.Error())
		helpers.SendError(w, "AI paper report scanning failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, result)
}





