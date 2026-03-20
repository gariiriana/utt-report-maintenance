package services

import (
	"context"
	"fmt"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/repositories"
)

// ArchiveService handles moving documents to the archive collection.
type ArchiveService struct {
	Repo *repositories.ArchiveRepository
}

// NewArchiveService constructs a new ArchiveService.
func NewArchiveService(repo *repositories.ArchiveRepository) *ArchiveService {
	return &ArchiveService{Repo: repo}
}

// ArchiveDocument copies a document into the archive collection and optionally
// deletes it from the source collection.
func (s *ArchiveService) ArchiveDocument(ctx context.Context, originalCollection, docID, archivedByUID string, data map[string]interface{}) error {
	if err := s.Repo.Archive(ctx, originalCollection, docID, archivedByUID, data); err != nil {
		return fmt.Errorf("ArchiveService.ArchiveDocument: %w", err)
	}
	return nil
}

// GetArchive retrieves a single archived document by ID.
func (s *ArchiveService) GetArchive(ctx context.Context, docID string) (map[string]interface{}, error) {
	snap, err := s.Repo.GetByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("ArchiveService.GetArchive(%s): %w", docID, err)
	}
	d := snap.Data()
	d["id"] = snap.Ref.ID
	return d, nil
}

// ListByCollection returns all archived documents from a given source collection.
func (s *ArchiveService) ListByCollection(ctx context.Context, originalCollection string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	snaps, err := s.Repo.List(ctx, originalCollection, limit)
	if err != nil {
		return nil, fmt.Errorf("ArchiveService.ListByCollection(%s): %w", originalCollection, err)
	}

	results := make([]map[string]interface{}, 0, len(snaps))
	for _, snap := range snaps {
		d := snap.Data()
		d["id"] = snap.Ref.ID
		results = append(results, d)
	}
	return results, nil
}

// ListByUser returns all archives created by a specific user.
func (s *ArchiveService) ListByUser(ctx context.Context, uid string, limit int) ([]map[string]interface{}, error) {
	snaps, err := s.Repo.ListByUser(ctx, uid, limit)
	if err != nil {
		return nil, fmt.Errorf("ArchiveService.ListByUser(%s): %w", uid, err)
	}

	results := make([]map[string]interface{}, 0, len(snaps))
	for _, snap := range snaps {
		d := snap.Data()
		d["id"] = snap.Ref.ID
		results = append(results, d)
	}
	return results, nil
}

// PermanentDelete permanently removes an archived document (admin only).
func (s *ArchiveService) PermanentDelete(ctx context.Context, docID string) error {
	if err := s.Repo.Delete(ctx, docID); err != nil {
		return fmt.Errorf("ArchiveService.PermanentDelete(%s): %w", docID, err)
	}
	return nil
}
