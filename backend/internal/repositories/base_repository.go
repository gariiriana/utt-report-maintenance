package repositories

import (
	"context"

	"cloud.google.com/go/firestore"
)

// IBaseRepository defines the minimum contract for any Firestore repository.
type IBaseRepository interface {
	// CollectionName returns the Firestore collection name this repo manages.
	CollectionName() string
}

// IReportRepository defines the contract for report data access.
type IReportRepository interface {
	IBaseRepository
	SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error)
	SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error
	GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error)
	List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error)
	Delete(ctx context.Context, collectionName, docID string) error
}

// IUserRepository defines the contract for user data access.
type IUserRepository interface {
	IBaseRepository
	GetByUID(ctx context.Context, uid string) (*firestore.DocumentSnapshot, error)
	Upsert(ctx context.Context, uid string, data map[string]interface{}) error
	UpdateField(ctx context.Context, uid, field string, value interface{}) error
	List(ctx context.Context, limit, offset int) ([]*firestore.DocumentSnapshot, error)
}

// IAuditRepository defines the contract for audit log persistence.
type IAuditRepository interface {
	IBaseRepository
	Save(ctx context.Context, data map[string]interface{}) error
	ListByUser(ctx context.Context, userUID string, limit int) ([]*firestore.DocumentSnapshot, error)
	ListAll(ctx context.Context, limit int) ([]*firestore.DocumentSnapshot, error)
}
