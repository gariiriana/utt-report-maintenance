package services

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/core/repositories"
)

// IFindingService defines the contract for finding business logic.
type IFindingService interface {
	CreateFinding(ctx context.Context, finding models.Finding) (string, error)
	ListFindings(ctx context.Context) ([]models.Finding, error)
	DeleteFinding(ctx context.Context, id string) error
}

type findingService struct {
	repo repositories.IFindingRepository
}

func NewFindingService(repo repositories.IFindingRepository) IFindingService {
	return &findingService{repo: repo}
}

func (s *findingService) CreateFinding(ctx context.Context, f models.Finding) (string, error) {
	id := fmt.Sprintf("finding_%s_%d", f.PartNumber, time.Now().UnixNano())
	f.CreatedAt = time.Now()

	// Convert photos to []interface{} for Firestore
	photos := make([]interface{}, len(f.Photos))
	for i, p := range f.Photos {
		photos[i] = map[string]interface{}{
			"base64":      p.Base64,
			"description": p.Description,
		}
	}

	data := map[string]interface{}{
		"part_name":        f.PartName,
		"part_number":      f.PartNumber,
		"brand_name":       f.BrandName,
		"quantity":         f.Quantity,
		"photos":           photos,
		"remark":           f.Remark,
		"created_by":       f.CreatedBy,
		"created_by_email": f.CreatedByEmail,
		"created_at":       f.CreatedAt,
	}

	if err := s.repo.Save(ctx, id, data); err != nil {
		return "", err
	}
	return id, nil
}

func (s *findingService) ListFindings(ctx context.Context) ([]models.Finding, error) {
	docs, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	var findings []models.Finding
	for _, doc := range docs {
		var f models.Finding
		if err := doc.DataTo(&f); err != nil {
			return nil, err
		}
		f.ID = doc.Ref.ID
		findings = append(findings, f)
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(findings, func(i, j int) bool {
		return findings[i].CreatedAt.After(findings[j].CreatedAt)
	})

	return findings, nil
}

func (s *findingService) DeleteFinding(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
