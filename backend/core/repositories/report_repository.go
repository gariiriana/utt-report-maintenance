package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)
type ReportRepository struct {
	Client *firestore.Client
}
func NewReportRepository(client *firestore.Client) *ReportRepository {
	return &ReportRepository{Client: client}
}
func (r *ReportRepository) CollectionName() string { return "reports" }
func (r *ReportRepository) SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error) {
	docRef, _, err := r.Client.Collection(collectionName).Add(ctx, data)
	if err != nil {
		return nil, fmt.Errorf("SaveReport(%s): %w", collectionName, err)
	}
	return docRef, nil
}
func (r *ReportRepository) SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error {
	_, _, err := docRef.Collection(subCollectionName).Add(ctx, data)
	if err != nil {
		return fmt.Errorf("SaveSubData(%s): %w", subCollectionName, err)
	}
	return nil
}
func (r *ReportRepository) GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(collectionName).Doc(docID).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetByID(%s/%s): %w", collectionName, docID, err)
	}
	return snap, nil
}
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
func (r *ReportRepository) Update(ctx context.Context, collectionName, docID string, updates map[string]interface{}) error {
	ref := r.Client.Collection(collectionName).Doc(docID)
	_, err := ref.Set(ctx, updates, firestore.MergeAll)
	if err != nil {
		return fmt.Errorf("Update(%s/%s): %w", collectionName, docID, err)
	}
	return nil
}
func (r *ReportRepository) Delete(ctx context.Context, collectionName, docID string) error {
	_, err := r.Client.Collection(collectionName).Doc(docID).Delete(ctx)
	if err != nil {
		return fmt.Errorf("Delete(%s/%s): %w", collectionName, docID, err)
	}
	return nil
}
func (r *ReportRepository) Count(ctx context.Context, collectionName string) (int64, error) {
	q := r.Client.Collection(collectionName)
	alias := "count"
	aq := q.NewAggregationQuery().WithCount(alias)

	results, err := aq.Get(ctx)
	if err != nil {
		return 0, fmt.Errorf("Count(%s): %w", collectionName, err)
	}

	countVal, ok := results[alias]
	if !ok {
		return 0, fmt.Errorf("Count(%s): failed to find aggregation result", collectionName)
	}
	count, ok := countVal.(int64)
	if !ok {
		return 0, fmt.Errorf("Count(%s): failed to parse aggregation result as int64 (type: %T)", collectionName, countVal)
	}

	return count, nil
}
