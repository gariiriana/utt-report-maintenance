package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)

// ReportRepository handles Firestore CRUD operations for report documents.
type ReportRepository struct {
	Client *firestore.Client
}

// NewReportRepository constructs a new ReportRepository.
func NewReportRepository(client *firestore.Client) *ReportRepository {
	return &ReportRepository{Client: client}
}

// CollectionName returns the primary collection name (varies per report type).
func (r *ReportRepository) CollectionName() string { return "reports" }

// SaveReport adds a new document to the given collection.
func (r *ReportRepository) SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error) {
	docRef, _, err := r.Client.Collection(collectionName).Add(ctx, data)
	if err != nil {
		return nil, fmt.Errorf("SaveReport(%s): %w", collectionName, err)
	}
	return docRef, nil
}

// SaveSubData adds a document to a sub-collection of an existing document.
func (r *ReportRepository) SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error {
	_, _, err := docRef.Collection(subCollectionName).Add(ctx, data)
	if err != nil {
		return fmt.Errorf("SaveSubData(%s): %w", subCollectionName, err)
	}
	return nil
}

// GetByID retrieves a single document by its ID from the specified collection.
func (r *ReportRepository) GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(collectionName).Doc(docID).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetByID(%s/%s): %w", collectionName, docID, err)
	}
	return snap, nil
}

// List retrieves documents from a collection with limit and offset (using offset pagination).
func (r *ReportRepository) List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(collectionName).
		OrderBy("created_at", firestore.Desc).
		Offset(offset).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("List(%s): %w", collectionName, err)
	}
	return docs, nil
}

// ListByAuthor retrieves reports belonging to a specific user.
func (r *ReportRepository) ListByAuthor(ctx context.Context, collectionName, authorUID string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(collectionName).
		Where("author_uid", "==", authorUID).
		OrderBy("created_at", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("ListByAuthor(%s): %w", collectionName, err)
	}
	return docs, nil
}

// Update merges the provided fields into an existing document.
func (r *ReportRepository) Update(ctx context.Context, collectionName, docID string, updates map[string]interface{}) error {
	ref := r.Client.Collection(collectionName).Doc(docID)
	_, err := ref.Set(ctx, updates, firestore.MergeAll)
	if err != nil {
		return fmt.Errorf("Update(%s/%s): %w", collectionName, docID, err)
	}
	return nil
}

// Delete removes a document from the given collection.
func (r *ReportRepository) Delete(ctx context.Context, collectionName, docID string) error {
	_, err := r.Client.Collection(collectionName).Doc(docID).Delete(ctx)
	if err != nil {
		return fmt.Errorf("Delete(%s/%s): %w", collectionName, docID, err)
	}
	return nil
}

// Count returns the number of documents in a collection by fetching all IDs.
// For large collections prefer a counter document pattern instead.
func (r *ReportRepository) Count(ctx context.Context, collectionName string) (int64, error) {
	docs, err := r.Client.Collection(collectionName).
		Select().
		Documents(ctx).GetAll()
	if err != nil {
		return 0, fmt.Errorf("Count(%s): %w", collectionName, err)
	}
	return int64(len(docs)), nil
}

