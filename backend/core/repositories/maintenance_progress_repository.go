package repositories

import (
	"context"
	"fmt"

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

func (r *maintenanceProgressRepository) BatchUpdate(ctx context.Context, updates map[string]map[string]interface{}) error {
	const maxBatchSize = 400

	type updateItem struct {
		id   string
		data map[string]interface{}
	}
	items := make([]updateItem, 0, len(updates))
	for id, data := range updates {
		items = append(items, updateItem{id: id, data: data})
	}

	for i := 0; i < len(items); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(items) {
			end = len(items)
		}

		batch := r.client.Batch()
		coll := r.client.Collection(r.CollectionName())
		for _, item := range items[i:end] {
			docRef := coll.Doc(item.id)
			batch.Set(docRef, item.data, firestore.MergeAll)
		}

		_, err := batch.Commit(ctx)
		if err != nil {
			return fmt.Errorf("failed to commit batch chunk %d-%d: %w", i, end, err)
		}
	}
	return nil
}
