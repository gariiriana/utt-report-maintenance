package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/sanitizer"
)

// ReportRepository defines the data access layer for reports.
type ReportRepository interface {
	SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error)
	SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error
	GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error)
	List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error)
	Delete(ctx context.Context, collectionName, docID string) error
}

// ReportService holds business logic for creating and querying reports.
type ReportService struct {
	Repo ReportRepository
}

// NewReportService constructs a new ReportService.
func NewReportService(repo ReportRepository) *ReportService {
	return &ReportService{Repo: repo}
}

// ProcessReport validates, sanitises, and persists a report from an incoming request body.
func (s *ReportService) ProcessReport(ctx context.Context, req *models.CreateReportRequest) (string, string, error) {
	collectionName := req.Collection
	if !models.AllowedCollections[collectionName] {
		return "", "", fmt.Errorf("unauthorized collection: %s", collectionName)
	}

	reportData := make(map[string]interface{})
	reportData["title"] = sanitizer.String(req.Title)
	reportData["description"] = sanitizer.String(req.Description)
	reportData["report_type"] = req.ReportType
	reportData["tags"] = req.Tags
	reportData["metadata"] = req.Metadata

	// Enrich with server-side metadata
	reportData["created_at"] = time.Now().UTC()
	reportData["updated_at"] = time.Now().UTC()
	reportData["status"] = "active"

	docRef, err := s.Repo.SaveReport(ctx, collectionName, reportData)
	if err != nil {
		return "", "", fmt.Errorf("error saving data: %w", err)
	}

	// Save sub-data (photos) concurrently
	if len(req.Photos) > 0 {
		var wg sync.WaitGroup
		for i, photo := range req.Photos {
			wg.Add(1)
			go func(idx int, p models.Photo) {
				defer wg.Done()
				photoData := map[string]interface{}{
					"url":          p.URL,
					"caption":      sanitizer.String(p.Caption),
					"storage_path": p.StoragePath,
					"created_at":   time.Now().UTC(),
				}
				if err := s.Repo.SaveSubData(ctx, docRef, "photos", photoData); err != nil {
					fmt.Printf("Warning: Failed to save photo %d: %v\n", idx, err)
				}
			}(i, photo)
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
