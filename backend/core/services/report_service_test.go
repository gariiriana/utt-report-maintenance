package services

import (
	"context"
	"testing"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/DwimitraSystem/backend/core/models"
)
type mockReportRepo struct {
	saveReportCalled bool
	lastCollection   string
}

func (m *mockReportRepo) SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error) {
	m.saveReportCalled = true
	m.lastCollection = collectionName
	return &firestore.DocumentRef{ID: "mock-id"}, nil
}

func (m *mockReportRepo) SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error {
	return nil
}

func (m *mockReportRepo) GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error) {
	return nil, nil
}

func (m *mockReportRepo) List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error) {
	return nil, nil
}

func (m *mockReportRepo) Delete(ctx context.Context, collectionName, docID string) error {
	return nil
}

func TestProcessReport(t *testing.T) {
	mockRepo := &mockReportRepo{}
	svc := NewReportService(mockRepo)

	req := &models.CreateReportRequest{
		Collection: "hse",
		Title:      "Test",
		ReportType: "hse",
	}

	id, coll, err := svc.ProcessReport(context.Background(), req)

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if id != "mock-id" {
		t.Errorf("Expected ID mock-id, got %s", id)
	}
	if coll != "hse" {
		t.Errorf("Expected collection hse, got %s", coll)
	}
	if !mockRepo.saveReportCalled {
		t.Error("SaveReport was not called")
	}
}
