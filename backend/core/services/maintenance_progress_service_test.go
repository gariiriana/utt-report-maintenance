package services

import (
	"context"
	"errors"
	"testing"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
)

type mockMaintenanceProgressRepo struct {
	saveCalled        bool
	updateCalled      bool
	batchUpdateCalled bool
	lastUpdates       map[string]map[string]interface{}
}

func (m *mockMaintenanceProgressRepo) CollectionName() string {
	return "maintenance_progress"
}

func (m *mockMaintenanceProgressRepo) Save(ctx context.Context, id string, data map[string]interface{}) error {
	m.saveCalled = true
	return nil
}

func (m *mockMaintenanceProgressRepo) GetByID(ctx context.Context, id string) (*firestore.DocumentSnapshot, error) {
	return nil, errors.New("document not found in mock")
}

func (m *mockMaintenanceProgressRepo) List(ctx context.Context) ([]*firestore.DocumentSnapshot, error) {
	return nil, nil
}

func (m *mockMaintenanceProgressRepo) Update(ctx context.Context, id string, data map[string]interface{}) error {
	m.updateCalled = true
	return nil
}

func (m *mockMaintenanceProgressRepo) Delete(ctx context.Context, id string) error {
	return nil
}

func (m *mockMaintenanceProgressRepo) BatchUpdate(ctx context.Context, updates map[string]map[string]interface{}) error {
	m.batchUpdateCalled = true
	m.lastUpdates = updates
	return nil
}

func TestEndDayEmpty(t *testing.T) {
	mockRepo := &mockMaintenanceProgressRepo{}
	svc := NewMaintenanceProgressService(mockRepo)

	err := svc.EndDay(context.Background())
	if err != nil {
		t.Errorf("Unexpected error in EndDay: %v", err)
	}

	if mockRepo.batchUpdateCalled {
		t.Error("BatchUpdate should not be called when progressList is empty")
	}
}

func TestCreateProgress(t *testing.T) {
	mockRepo := &mockMaintenanceProgressRepo{}
	svc := NewMaintenanceProgressService(mockRepo)

	input := models.MaintenanceProgress{
		Category:      "WLD",
		EquipmentName: "Water Leak Detector 01",
		PlanQty:       10,
		ActualQty:     5,
	}

	id, err := svc.CreateProgress(context.Background(), input)
	if err != nil {
		t.Errorf("Unexpected error in CreateProgress: %v", err)
	}

	if id == "" {
		t.Error("Expected auto-generated UUID, got empty string")
	}

	if !mockRepo.saveCalled {
		t.Error("repo.Save was not called")
	}
}

func TestUpdateProgressNotFound(t *testing.T) {
	mockRepo := &mockMaintenanceProgressRepo{}
	svc := NewMaintenanceProgressService(mockRepo)

	err := svc.UpdateProgress(context.Background(), "some-id", 5, "remark")
	if err == nil {
		t.Error("Expected error because GetByID returns not found, got nil")
	}
}
