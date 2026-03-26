package repositories

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
)

const archiveCollection = "archive"
type ArchiveRepository struct {
	Client *firestore.Client
}
func NewArchiveRepository(client *firestore.Client) *ArchiveRepository {
	return &ArchiveRepository{Client: client}
}
func (r *ArchiveRepository) CollectionName() string { return archiveCollection }
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
func (r *ArchiveRepository) GetByID(ctx context.Context, docID string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(archiveCollection).Doc(docID).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("ArchiveRepository.GetByID(%s): %w", docID, err)
	}
	return snap, nil
}
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
func (r *ArchiveRepository) Delete(ctx context.Context, docID string) error {
	_, err := r.Client.Collection(archiveCollection).Doc(docID).Delete(ctx)
	if err != nil {
		return fmt.Errorf("ArchiveRepository.Delete(%s): %w", docID, err)
	}
	return nil
}
