package repositories

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
)

const userCollection = "users"

// UserRepository handles Firestore operations for the users collection.
type UserRepository struct {
	Client *firestore.Client
}

// NewUserRepository constructs a new UserRepository.
func NewUserRepository(client *firestore.Client) *UserRepository {
	return &UserRepository{Client: client}
}

// CollectionName returns the Firestore collection name.
func (r *UserRepository) CollectionName() string { return userCollection }

// GetByUID retrieves a user document by Firebase UID.
func (r *UserRepository) GetByUID(ctx context.Context, uid string) (*firestore.DocumentSnapshot, error) {
	snap, err := r.Client.Collection(userCollection).Doc(uid).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("UserRepository.GetByUID(%s): %w", uid, err)
	}
	return snap, nil
}

// Upsert creates or updates a user document identified by UID.
func (r *UserRepository) Upsert(ctx context.Context, uid string, data map[string]interface{}) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Set(ctx, data, firestore.MergeAll)
	if err != nil {
		return fmt.Errorf("UserRepository.Upsert(%s): %w", uid, err)
	}
	return nil
}

// UpdateField atomically updates a single field on a user document.
func (r *UserRepository) UpdateField(ctx context.Context, uid, field string, value interface{}) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Update(ctx, []firestore.Update{
		{Path: field, Value: value},
	})
	if err != nil {
		return fmt.Errorf("UserRepository.UpdateField(%s.%s): %w", uid, field, err)
	}
	return nil
}

// Delete removes a user document.
func (r *UserRepository) Delete(ctx context.Context, uid string) error {
	_, err := r.Client.Collection(userCollection).Doc(uid).Delete(ctx)
	if err != nil {
		return fmt.Errorf("UserRepository.Delete(%s): %w", uid, err)
	}
	return nil
}

// List retrieves a paginated list of users ordered by email.
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

// ListByRole retrieves all users with the given role.
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

// Exists returns true if a user document with the given UID exists.
func (r *UserRepository) Exists(ctx context.Context, uid string) (bool, error) {
	snap, err := r.Client.Collection(userCollection).Doc(uid).Get(ctx)
	if err != nil {
		return false, nil // not found is treated as does not exist
	}
	return snap.Exists(), nil
}
