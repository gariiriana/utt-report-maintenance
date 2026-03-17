package repositories

import (
	"context"

	"cloud.google.com/go/firestore"
)

type ReportRepository struct {
	Client *firestore.Client
}

func NewReportRepository(client *firestore.Client) *ReportRepository {
	return &ReportRepository{Client: client}
}

func (r *ReportRepository) SaveReport(ctx context.Context, collectionName string, data map[string]interface{}) (*firestore.DocumentRef, error) {
	docRef, _, err := r.Client.Collection(collectionName).Add(ctx, data)
	return docRef, err
}

func (r *ReportRepository) SaveSubData(ctx context.Context, docRef *firestore.DocumentRef, subCollectionName string, data map[string]interface{}) error {
	_, _, err := docRef.Collection(subCollectionName).Add(ctx, data)
	return err
}
