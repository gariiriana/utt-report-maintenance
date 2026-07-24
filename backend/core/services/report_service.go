package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/sanitizer"
)
type ReportRepository interface {
	SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error)
	SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error
	GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error)
	List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error)
	Delete(ctx context.Context, collectionName, docID string) error
}
type ReportService struct {
	Repo ReportRepository
}
func NewReportService(repo ReportRepository) *ReportService {
	return &ReportService{Repo: repo}
}
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
	reportData["created_at"] = time.Now().UTC()
	reportData["updated_at"] = time.Now().UTC()
	reportData["status"] = "active"

	docRef, err := s.Repo.SaveReport(ctx, collectionName, reportData)
	if err != nil {
		return "", "", fmt.Errorf("error saving data: %w", err)
	}
	if len(req.Photos) > 0 {
		var wg sync.WaitGroup
		// Wave 6: Implement worker pool (semaphore) to prevent unbounded fan-out
		// Limit to 5 concurrent Firestore writes per report request
		const maxWorkers = 5
		sem := make(chan struct{}, maxWorkers)

		for i, photo := range req.Photos {
			wg.Add(1)
			go func(idx int, p models.Photo) {
				defer wg.Done()

				// Acquire worker slot
				sem <- struct{}{}
				defer func() { <-sem }() // Release worker slot

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
func (s *ReportService) DeleteReport(ctx context.Context, collectionName, docID string) error {
	if !models.AllowedCollections[collectionName] {
		return fmt.Errorf("unauthorized collection: %s", collectionName)
	}
	return s.Repo.Delete(ctx, collectionName, docID)
}
