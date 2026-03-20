package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)

const auditCollection = "audit_logs"

// AuditRepository handles persistence of audit log entries in Firestore.
type AuditRepository struct {
	Client *firestore.Client
}

// NewAuditRepository constructs a new AuditRepository.
func NewAuditRepository(client *firestore.Client) *AuditRepository {
	return &AuditRepository{Client: client}
}

// CollectionName returns the Firestore collection name.
func (r *AuditRepository) CollectionName() string { return auditCollection }

// Save persists a new audit log entry.
func (r *AuditRepository) Save(ctx context.Context, data map[string]interface{}) error {
	_, _, err := r.Client.Collection(auditCollection).Add(ctx, data)
	if err != nil {
		return fmt.Errorf("AuditRepository.Save: %w", err)
	}
	return nil
}

// ListByUser retrieves audit entries for a specific user, ordered by timestamp descending.
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

// ListAll retrieves all audit log entries, ordered by timestamp descending.
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

// ListByAction retrieves audit entries for a specific action type.
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

// ListByCollection retrieves audit entries related to a specific Firestore collection.
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
