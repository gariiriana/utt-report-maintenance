package repositories

import (
	"context"

	"cloud.google.com/go/firestore"
)
type IBaseRepository interface {
	CollectionName() string
}
type IReportRepository interface {
	IBaseRepository
	SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error)
	SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error
	GetByID(ctx context.Context, collectionName, docID string) (*firestore.DocumentSnapshot, error)
	List(ctx context.Context, collectionName string, limit, offset int) ([]*firestore.DocumentSnapshot, error)
	Delete(ctx context.Context, collectionName, docID string) error
}
type IUserRepository interface {
	IBaseRepository
	GetByUID(ctx context.Context, uid string) (*firestore.DocumentSnapshot, error)
	Upsert(ctx context.Context, uid string, data map[string]interface{}) error
	UpdateField(ctx context.Context, uid, field string, value interface{}) error
	List(ctx context.Context, limit, offset int) ([]*firestore.DocumentSnapshot, error)
}
type IAuditRepository interface {
	IBaseRepository
	Save(ctx context.Context, data map[string]interface{}) error
	ListByUser(ctx context.Context, userUID string, limit int) ([]*firestore.DocumentSnapshot, error)
	ListAll(ctx context.Context, limit int) ([]*firestore.DocumentSnapshot, error)
}
