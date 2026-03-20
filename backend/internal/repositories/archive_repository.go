package repositories

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
)

const archiveCollection = "archive"

// ArchiveRepository handles access to the archive collection in Firestore.
type ArchiveRepository struct {
	Client *firestore.Client
}

// NewArchiveRepository constructs a new ArchiveRepository.
func NewArchiveRepository(client *firestore.Client) *ArchiveRepository {
	return &ArchiveRepository{Client: client}
}

// CollectionName returns the Firestore collection name.
func (r *ArchiveRepository) CollectionName() string { return archiveCollection }

// Archive moves a document (as a copy) into the archive collection,
// tagging it with the archivedAt timestamp and the user who performed the action.
func (r *ArchiveRepository) Archive(ctx context.Context, originalCollection, docID, archivedByUID string, data map[string]interface{}) error {
	data["_original_collection"] = originalCollection
	data["_original_id"] = docID
	data["_archived_by"] = archivedByUID
	data["_archived_at"] = time.Now().UTC()

	_, err := r.Client.Collection(archiveCollection).Doc(docID).Set(ctx, data)
	if err != nil {
		return fmt.Errorf("ArchiveRepository.Archive(%s/%s): %w", originalCollection, docID, err)
	}
	return nil
}

// GetByID retrieves an archived document by its ID.
func (r *ArchiveRepository) GetByID(ctx context.Context, docID string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(archiveCollection).Doc(docID).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("ArchiveRepository.GetByID(%s): %w", docID, err)
	}
	return snap, nil
}

// List retrieves archived documents for a specific source collection, ordered by archive date.
func (r *ArchiveRepository) List(ctx context.Context, originalCollection string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(archiveCollection).
		Where("_original_collection", "==", originalCollection).
		OrderBy("_archived_at", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("ArchiveRepository.List(%s): %w", originalCollection, err)
	}
	return docs, nil
}

// ListByUser retrieves archives created by a specific user.
func (r *ArchiveRepository) ListByUser(ctx context.Context, uid string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(archiveCollection).
		Where("_archived_by", "==", uid).
		OrderBy("_archived_at", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("ArchiveRepository.ListByUser(%s): %w", uid, err)
	}
	return docs, nil
}

// Delete permanently removes an archived document.
func (r *ArchiveRepository) Delete(ctx context.Context, docID string) error {
	_, err := r.Client.Collection(archiveCollection).Doc(docID).Delete(ctx)
	if err != nil {
		return fmt.Errorf("ArchiveRepository.Delete(%s): %w", docID, err)
	}
	return nil
}
