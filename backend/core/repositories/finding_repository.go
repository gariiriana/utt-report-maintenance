package repositories

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

// IFindingRepository defines the contract for finding data access.
type IFindingRepository interface {
	IBaseRepository
	Save(ctx context.Context, id string, data map[string]interface{}) error
	GetByID(ctx context.Context, id string) (*firestore.DocumentSnapshot, error)
	List(ctx context.Context) ([]*firestore.DocumentSnapshot, error)
	Delete(ctx context.Context, id string) error
}

type findingRepository struct {
	client *firestore.Client
}

func NewFindingRepository(client *firestore.Client) IFindingRepository {
	return &findingRepository{client: client}
}

func (r *findingRepository) CollectionName() string {
	return "findings"
}

func (r *findingRepository) Save(ctx context.Context, id string, data map[string]interface{}) error {
	_, err := r.client.Collection(r.CollectionName()).Doc(id).Set(ctx, data)
	return err
}

func (r *findingRepository) GetByID(ctx context.Context, id string) (*firestore.DocumentSnapshot, error) {
	return r.client.Collection(r.CollectionName()).Doc(id).Get(ctx)
}

func (r *findingRepository) List(ctx context.Context) ([]*firestore.DocumentSnapshot, error) {
	var docs []*firestore.DocumentSnapshot
	iter := r.client.Collection(r.CollectionName()).Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (r *findingRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.CollectionName()).Doc(id).Delete(ctx)
	return err
}
