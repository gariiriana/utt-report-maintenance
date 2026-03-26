package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)

const userCollection = "users"
type UserRepository struct {
	Client *firestore.Client
}
func NewUserRepository(client *firestore.Client) *UserRepository {
	return &UserRepository{Client: client}
}
func (r *UserRepository) CollectionName() string { return userCollection }
func (r *UserRepository) GetByUID(ctx context.Context, uid string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(userCollection).Doc(uid).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("UserRepository.GetByUID(%s): %w", uid, err)
	}
	return snap, nil
}
func (r *UserRepository) Upsert(ctx context.Context, uid string, data map[string]interface{}) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Set(ctx, data, firestore.MergeAll)
	if err != nil {
		return fmt.Errorf("UserRepository.Upsert(%s): %w", uid, err)
	}
	return nil
}
func (r *UserRepository) UpdateField(ctx context.Context, uid, field string, value interface{}) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Update(ctx, []firestore.Update{
		{Path: field, Value: value},
	})
	if err != nil {
		return fmt.Errorf("UserRepository.UpdateField(%s.%s): %w", uid, field, err)
	}
	return nil
}
func (r *UserRepository) Delete(ctx context.Context, uid string) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Delete(ctx)
	if err != nil {
		return fmt.Errorf("UserRepository.Delete(%s): %w", uid, err)
	}
	return nil
}
func (r *UserRepository) List(ctx context.Context, limit, offset int) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(userCollection).
		OrderBy("email", firestore.Asc).
		Offset(offset).
		Limit(limit)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("UserRepository.List: %w", err)
	}
	return docs, nil
}
func (r *UserRepository) ListByRole(ctx context.Context, role string) ([]*firestore.DocumentSnapshot, error) {
	q := r.Client.Collection(userCollection).
		Where("role", "==", role).
		OrderBy("email", firestore.Asc)

	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("UserRepository.ListByRole(%s): %w", role, err)
	}
	return docs, nil
}
func (r *UserRepository) Exists(ctx context.Context, uid string) (bool, error) {
	snap, err := r.Client.Collection(userCollection).Doc(uid).Get(ctx)
	if err != nil {
		return false, nil // not found is treated as does not exist
	}
	return snap.Exists(), nil
}
