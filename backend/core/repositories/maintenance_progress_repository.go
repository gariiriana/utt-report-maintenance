package repositories

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type maintenanceProgressRepository struct {
	client *firestore.Client
}

func NewMaintenanceProgressRepository(client *firestore.Client) IMaintenanceProgressRepository {
	return &maintenanceProgressRepository{client: client}
}

func (r *maintenanceProgressRepository) CollectionName() string {
	return "maintenance_progress"
}

func (r *maintenanceProgressRepository) Save(ctx context.Context, id string, data map[string]interface{}) error {
	_, err := r.client.Collection(r.CollectionName()).Doc(id).Set(ctx, data)
	return err
}

func (r *maintenanceProgressRepository) GetByID(ctx context.Context, id string) (*firestore.DocumentSnapshot, error) {
	return r.client.Collection(r.CollectionName()).Doc(id).Get(ctx)
}

func (r *maintenanceProgressRepository) List(ctx context.Context) ([]*firestore.DocumentSnapshot, error) {
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

func (r *maintenanceProgressRepository) Update(ctx context.Context, id string, data map[string]interface{}) error {
	_, err := r.client.Collection(r.CollectionName()).Doc(id).Set(ctx, data, firestore.MergeAll)
	return err
}

func (r *maintenanceProgressRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.CollectionName()).Doc(id).Delete(ctx)
	return err
}
