package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/sanitizer"
)

// ReportService holds business logic for creating and querying reports.
type ReportService struct {
	Repo *repositories.ReportRepository
}

// NewReportService constructs a new ReportService.
func NewReportService(repo *repositories.ReportRepository) *ReportService {
	return &ReportService{Repo: repo}
}

// ProcessReport validates, sanitises, and persists a report from an incoming request body.
func (s *ReportService) ProcessReport(ctx context.Context, requestBody map[string]interface{}) (string, string, error) {
	collectionName, ok := requestBody["collection"].(string)
	if !ok || collectionName == "" {
		collectionName = string(models.ReportTypeHSE)
	}

	if !models.AllowedCollections[collectionName] {
		return "", "", fmt.Errorf("unauthorized collection: %s", collectionName)
	}

	reportData := make(map[string]interface{})
	for k, v := range requestBody {
		if k == "collection" || k == "sub_data" {
			continue
		}
		reportData[k] = v
	}

	// Sanitize all string values
	reportData = sanitizer.Map(reportData)

	// Enrich with server-side metadata
	reportData["created_at"] = time.Now().UTC()
	reportData["updated_at"] = time.Now().UTC()
	reportData["status"] = "active"

	docRef, err := s.Repo.SaveReport(ctx, collectionName, reportData)
	if err != nil {
		return "", "", fmt.Errorf("error saving data: %w", err)
	}

	// Save sub-data (photos) concurrently
	if subData, ok := requestBody["sub_data"].([]interface{}); ok {
		var wg sync.WaitGroup
		for i, item := range subData {
			if itemMap, ok := item.(map[string]interface{}); ok {
				wg.Add(1)
				go func(idx int, data map[string]interface{}) {
					defer wg.Done()
					cleanData := sanitizer.Map(data)
					if err := s.Repo.SaveSubData(ctx, docRef, "photos", cleanData); err != nil {
						fmt.Printf("Warning: Failed to save photo %d: %v\n", idx, err)
					}
				}(i, itemMap)
			}
		}
		wg.Wait()
	}

	return docRef.ID, collectionName, nil
}

// GetReport retrieves a single report by ID from the specified collection.
func (s *ReportService) GetReport(ctx context.Context, collectionName, docID string) (map[string]interface{}, error) {
	if !models.AllowedCollections[collectionName] {
		return nil, fmt.Errorf("unauthorized collection: %s", collectionName)
	}

	snap, err := s.Repo.GetByID(ctx, collectionName, docID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}
	data := snap.Data()
	data["id"] = snap.Ref.ID
	return data, nil
}

// ListReports returns a paginated list of reports from a collection.
func (s *ReportService) ListReports(ctx context.Context, collectionName string, limit, offset int) ([]map[string]interface{}, error) {
	if !models.AllowedCollections[collectionName] {
		return nil, fmt.Errorf("unauthorized collection: %s", collectionName)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	snaps, err := s.Repo.List(ctx, collectionName, limit, offset)
	if err != nil {
		return nil, err
	}

	results := make([]map[string]interface{}, 0, len(snaps))
	for _, snap := range snaps {
		d := snap.Data()
		d["id"] = snap.Ref.ID
		results = append(results, d)
	}
	return results, nil
}

// DeleteReport removes a report and records the author for audit purposes.
func (s *ReportService) DeleteReport(ctx context.Context, collectionName, docID string) error {
	if !models.AllowedCollections[collectionName] {
		return fmt.Errorf("unauthorized collection: %s", collectionName)
	}
	return s.Repo.Delete(ctx, collectionName, docID)
}
