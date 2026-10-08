package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
)

type mockMOPTranslateService struct {
	result []services.MOPTranslation
	err    error
	calls  int
}

func (m *mockMOPTranslateService) Translate(_ context.Context, _ string, _ []string, _ []int) ([]services.MOPTranslation, error) {
	m.calls++
	return m.result, m.err
}

func mopRequest(t *testing.T, email string, body any) *http.Request {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/mop/translate", bytes.NewReader(raw))
	ctx := context.WithValue(req.Context(), middlewares.UserEmailKeyExported, email)
	return req.WithContext(ctx)
}

func validMOPBody() MOPTranslateRequest {
	return MOPTranslateRequest{
		Title:    "MOP Cooling Tower",
		Segments: []string{"Section 1 – Document Overview", "Ensure that the PTW has been approved"},
		Indices:  []int{0, 1},
	}
}

func TestMOPTranslate_ForbiddenForOtherAccounts(t *testing.T) {
	svc := &mockMOPTranslateService{}
	rec := httptest.NewRecorder()
	NewMOPController(svc).Translate(rec, mopRequest(t, "engineer@dme.com", validMOPBody()))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
	if svc.calls != 0 {
		t.Fatalf("service must not be called for unauthorized users")
	}
}

func TestMOPTranslate_RejectsOutOfRangeIndex(t *testing.T) {
	body := validMOPBody()
	body.Indices = []int{0, 5}
	rec := httptest.NewRecorder()
	NewMOPController(&mockMOPTranslateService{}).Translate(rec, mopRequest(t, "dwimitra@co.id", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestMOPTranslate_NotConfiguredReturns503(t *testing.T) {
	svc := &mockMOPTranslateService{err: services.ErrMOPTranslateNotConfigured}
	rec := httptest.NewRecorder()
	NewMOPController(svc).Translate(rec, mopRequest(t, "DWIMITRA@co.id", validMOPBody()))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}

func TestMOPTranslate_Success(t *testing.T) {
	svc := &mockMOPTranslateService{result: []services.MOPTranslation{
		{Index: 0, Text: "Bagian 1 – Ikhtisar Dokumen"},
		{Index: 1, Text: "Pastikan PTW telah disetujui"},
	}}
	rec := httptest.NewRecorder()
	NewMOPController(svc).Translate(rec, mopRequest(t, "qcdme@dme.com", validMOPBody()))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Translations []services.MOPTranslation `json:"translations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if len(resp.Translations) != 2 || resp.Translations[1].Text != "Pastikan PTW telah disetujui" {
		t.Fatalf("unexpected translations: %+v", resp.Translations)
	}
}
