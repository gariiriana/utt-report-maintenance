package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)

const auditCollection = "audit_logs"
type AuditRepository struct {
	Client *firestore.Client
}
func NewAuditRepository(client *firestore.Client) *AuditRepository {
	return &AuditRepository{Client: client}
}
func (r *AuditRepository) CollectionName() string { return auditCollection }
func (r *AuditRepository) Save(ctx context.Context, data map[string]interface{}) error {
	_, _, err := r.Client.Collection(auditCollection).Add(ctx, data)
	if err != nil {
		return fmt.Errorf("AuditRepository.Save: %w", err)
	}
	return nil
}
func (r *AuditRepository) ListByUser(ctx context.Context, userUID string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(auditCollection).
		Where("user_uid", "==", userUID).
		OrderBy("timestamp", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("AuditRepository.ListByUser(%s): %w", userUID, err)
	}
	return docs, nil
}
func (r *AuditRepository) ListAll(ctx context.Context, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(auditCollection).
		OrderBy("timestamp", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("AuditRepository.ListAll: %w", err)
	}
	return docs, nil
}
func (r *AuditRepository) ListByAction(ctx context.Context, action string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(auditCollection).
		Where("action", "==", action).
		OrderBy("timestamp", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("AuditRepository.ListByAction(%s): %w", action, err)
	}
	return docs, nil
}
func (r *AuditRepository) ListByCollection(ctx context.Context, collection string, limit int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(auditCollection).
		Where("collection", "==", collection).
		OrderBy("timestamp", firestore.Desc).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("AuditRepository.ListByCollection(%s): %w", collection, err)
	}
	return docs, nil
}
