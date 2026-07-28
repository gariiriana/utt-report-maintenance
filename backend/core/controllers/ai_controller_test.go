package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
)

// ═══════════════════════════════════════════════════════════════════════════════
// API Validation — 17 Tests
// ═══════════════════════════════════════════════════════════════════════════════

// mockAIService implements services.IAIService for testing
type mockAIService struct {
	result *models.ATSReportData
	err    error
}

func (m *mockAIService) AnalyzeATSPhotos(_ context.Context, _ []models.ATSPhotoInput, _ *models.ATSReportData) (*models.ATSReportData, error) {
	return m.result, m.err
}

func (m *mockAIService) Chat(_ context.Context, _ []models.ChatMessage) (string, error) {
	return "mock reply", nil
}

func (m *mockAIService) ValidateATSForm(_ context.Context, _ models.ATSReportData, _ []models.ATSPhotoInput) (*models.FormValidationResponse, error) {
	return &models.FormValidationResponse{
		IsValid: true,
		Summary: "mock validation success",
	}, m.err
}

func (m *mockAIService) AnalyzeSingleCard(_ context.Context, _ models.CardAnalyzeRequest) (*models.CardAnalyzeResponse, error) {
	return &models.CardAnalyzeResponse{
		Parameter: "mock parameter value",
	}, m.err
}

func (m *mockAIService) AnalyzeFCUPhotos(_ context.Context, _ []models.FCUPhotoInput, _ *models.FCUReportData) (*models.FCUReportData, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzePJUPhotos(_ context.Context, _ []models.PJUPhotoInput, _ *models.PJUReportData) (*models.PJUReportData, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzePDUPhotos(_ context.Context, _ []models.PDUPhotoInput, _ *models.PDUReportData) (*models.PDUReportData, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeCTPhotos(_ context.Context, _ []models.CTPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeGeneratorPhotos(_ context.Context, _ []models.GeneratorPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeTrafoPhotos(_ context.Context, _ []models.TrafoPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeACSplitPhotos(_ context.Context, _ []models.ACSplitPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeBusductPhotos(_ context.Context, _ []models.BusductPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeDocklevelerPhotos(_ context.Context, _ []models.DocklevelerPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeDoorPhotos(_ context.Context, _ []models.DoorPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeCapacitorbankPhotos(_ context.Context, _ []models.CapacitorbankPhotoInput, _ any) (any, error) {
	return nil, m.err
}

func (m *mockAIService) AnalyzeLdbrdbPhotos(_ context.Context, _ []models.LdbrdbPhotoInput, _ any) (any, error) {
	return nil, m.err
}

// Ensure mockAIService implements IAIService
var _ services.IAIService = (*mockAIService)(nil)

func newTestController(result *models.ATSReportData, err error) *AIController {
	return NewAIController(&mockAIService{result: result, err: err})
}

func TestAnalyzeATSReport_MethodNotAllowed(t *testing.T) {
	t.Run("GET_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ai/ats-report", nil)
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("GET: status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
		}
	})

	t.Run("PUT_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodPut, "/api/ai/ats-report", nil)
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("PUT: status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
		}
	})
}

func TestAnalyzeATSReport_InvalidBody(t *testing.T) {
	t.Run("empty_body_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", strings.NewReader(""))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("Empty body: status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("invalid_json_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", strings.NewReader("{invalid json"))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("Invalid JSON: status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})
}

func TestAnalyzeATSReport_PhotoValidation(t *testing.T) {
	t.Run("no_photos_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: []models.ATSPhotoInput{}})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("No photos: status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("too_many_photos_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		photos := make([]models.ATSPhotoInput, 31)
		for i := range photos {
			photos[i] = models.ATSPhotoInput{Base64: "data", Category: "grounding"}
		}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("31 photos: status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("max_30_photos_accepted", func(t *testing.T) {
		ctrl := newTestController(&models.ATSReportData{}, nil)
		photos := make([]models.ATSPhotoInput, 30)
		for i := range photos {
			photos[i] = models.ATSPhotoInput{Base64: "data", Category: "grounding"}
		}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		// Should not be 400 (it may be 200 or 500 depending on service)
		if w.Code == http.StatusBadRequest {
			t.Error("30 photos should be accepted, got 400")
		}
	})

	t.Run("missing_base64_is_accepted_returns_200", func(t *testing.T) {
		ctrl := newTestController(&models.ATSReportData{}, nil)
		photos := []models.ATSPhotoInput{{Base64: "", Category: "grounding"}}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("Missing base64 should be accepted: status = %d, want %d", w.Code, http.StatusOK)
		}
	})

	t.Run("empty_category_gets_default", func(t *testing.T) {
		ctrl := newTestController(&models.ATSReportData{}, nil)
		photos := []models.ATSPhotoInput{{Base64: "data123", Category: ""}}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		// Should not be 400 — empty category gets defaulted to visual_inspection
		if w.Code == http.StatusBadRequest {
			t.Error("Empty category should be accepted (defaults to visual_inspection)")
		}
	})

	t.Run("single_photo_accepted", func(t *testing.T) {
		ctrl := newTestController(&models.ATSReportData{}, nil)
		photos := []models.ATSPhotoInput{{Base64: "validdata", Category: "thermal"}}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code == http.StatusBadRequest {
			t.Error("Single valid photo should be accepted")
		}
	})
}

func TestAnalyzeATSReport_SuccessResponse(t *testing.T) {
	t.Run("returns_200_with_valid_data", func(t *testing.T) {
		result := &models.ATSReportData{
			GroundingResistance: models.GroundingData{ResultOhm: "0.34", Standard: "<5 Ω"},
			ThermalMeasurement:  models.ThermalData{ResultTemperature: "28.5", Standard: "40°C"},
			OperationStatus:     models.OperationStatusData{IsNormal: true},
		}
		ctrl := newTestController(result, nil)
		photos := []models.ATSPhotoInput{{Base64: "data", Category: "grounding"}}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("Valid request: status = %d, want %d", w.Code, http.StatusOK)
		}
	})

	t.Run("response_contains_grounding_data", func(t *testing.T) {
		result := &models.ATSReportData{
			GroundingResistance: models.GroundingData{ResultOhm: "0.34"},
		}
		ctrl := newTestController(result, nil)
		photos := []models.ATSPhotoInput{{Base64: "data", Category: "grounding"}}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)

		respBody := w.Body.String()
		if !strings.Contains(respBody, "0.34") {
			t.Errorf("Response missing grounding value: %s", respBody)
		}
	})

	t.Run("mixed_categories_accepted", func(t *testing.T) {
		ctrl := newTestController(&models.ATSReportData{}, nil)
		photos := []models.ATSPhotoInput{
			{Base64: "a", Category: "grounding"},
			{Base64: "b", Category: "thermal"},
			{Base64: "c", Category: "power_meter"},
			{Base64: "d", Category: "visual_inspection"},
		}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if w.Code == http.StatusBadRequest {
			t.Error("Mixed categories should be accepted")
		}
	})
}

func TestAnalyzeATSReport_ErrorMessages(t *testing.T) {
	t.Run("error_message_for_no_photos", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: []models.ATSPhotoInput{}})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if !strings.Contains(w.Body.String(), "photo") {
			t.Errorf("Error should mention photos: %s", w.Body.String())
		}
	})

	t.Run("error_message_for_too_many", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		photos := make([]models.ATSPhotoInput, 31)
		for i := range photos {
			photos[i] = models.ATSPhotoInput{Base64: "x", Category: "grounding"}
		}
		body, _ := json.Marshal(models.ATSAnalyzeRequest{Photos: photos})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/ats-report", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeATSReport(w, req)
		if !strings.Contains(w.Body.String(), "30") {
			t.Errorf("Error should mention limit 30: %s", w.Body.String())
		}
	})
}

func TestAIChat(t *testing.T) {
	t.Run("POST_successful_chat", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.AIChatRequest{
			Messages: []models.ChatMessage{
				{Role: "user", Content: "Hello PAC"},
			},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/chat", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.Chat(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["reply"] != "mock reply" {
			t.Errorf("expected reply 'mock reply', got '%s'", resp["reply"])
		}
	})

	t.Run("GET_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ai/chat", nil)
		w := httptest.NewRecorder()
		ctrl.Chat(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", w.Code)
		}
	})

	t.Run("empty_messages_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.AIChatRequest{Messages: []models.ChatMessage{}})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/chat", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.Chat(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})
}

func TestValidateATSForm(t *testing.T) {
	t.Run("success_returns_200", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.FormValidationRequest{
			ReportData: models.ATSReportData{},
			Photos:     []models.ATSPhotoInput{},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/validate-form", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.ValidateATSForm(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
		var resp models.FormValidationResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp.Summary != "mock validation success" {
			t.Errorf("expected summary 'mock validation success', got '%s'", resp.Summary)
		}
	})

	t.Run("GET_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ai/validate-form", nil)
		w := httptest.NewRecorder()
		ctrl.ValidateATSForm(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", w.Code)
		}
	})

	t.Run("invalid_json_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/validate-form", strings.NewReader("{invalid"))
		w := httptest.NewRecorder()
		ctrl.ValidateATSForm(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})
}

func TestAnalyzeSingleCard(t *testing.T) {
	t.Run("success_returns_200", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.CardAnalyzeRequest{
			PhotoBase64: "dGVzdC1iYXNlNjQ=",
			Description: "grounding resistance",
			Category:    "grounding",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/analyze-card", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeSingleCard(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
		var resp models.CardAnalyzeResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp.Parameter != "mock parameter value" {
			t.Errorf("expected parameter 'mock parameter value', got '%s'", resp.Parameter)
		}
	})

	t.Run("missing_photo_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		body, _ := json.Marshal(models.CardAnalyzeRequest{
			Description: "missing photo",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/analyze-card", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ctrl.AnalyzeSingleCard(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("GET_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ai/analyze-card", nil)
		w := httptest.NewRecorder()
		ctrl.AnalyzeSingleCard(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", w.Code)
		}
	})
}

func TestAnalyzePDUReport_MethodNotAllowed(t *testing.T) {
	t.Run("GET_returns_405", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ai/pdu-report", nil)
		w := httptest.NewRecorder()
		ctrl.AnalyzePDUReport(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("GET: status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
		}
	})
}

func TestAnalyzePDUReport_InvalidBody(t *testing.T) {
	t.Run("empty_body_returns_400", func(t *testing.T) {
		ctrl := newTestController(nil, nil)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/pdu-report", strings.NewReader(""))
		w := httptest.NewRecorder()
		ctrl.AnalyzePDUReport(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("Empty body: status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})
}
