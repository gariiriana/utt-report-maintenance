package services

import (
	"context"
	"fmt"
	"time"

	"github.com/gariiriana/utt-report-maintenance/core/models"
	"github.com/gariiriana/utt-report-maintenance/core/repositories"
)
type UserService struct {
	Repo     *repositories.UserRepository
	AuthSvc  *AuthService
}
func NewUserService(repo *repositories.UserRepository, authSvc *AuthService) *UserService {
	return &UserService{Repo: repo, AuthSvc: authSvc}
}
func (s *UserService) GetProfile(ctx context.Context, uid string) (*models.UserProfile, error) {
	snap, err := s.Repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("UserService.GetProfile(%s): %w", uid, err)
	}

	var user models.User
	if err := snap.DataTo(&user); err != nil {
		return nil, fmt.Errorf("UserService.GetProfile: data binding failed: %w", err)
	}
	profile := user.ToProfile()
	return &profile, nil
}
func (s *UserService) UpsertFromLogin(ctx context.Context, uid, email, displayName, photoURL string) error {
	now := time.Now().UTC()
	data := map[string]interface{}{
		"uid":           uid,
		"email":         email,
		"display_name":  displayName,
		"photo_url":     photoURL,
		"is_active":     true,
		"last_login_at": now,
		"updated_at":    now,
	}
	exists, err := s.Repo.Exists(ctx, uid)
	if err != nil || !exists {
		data["created_at"] = now
		data["role"] = string(models.RoleGuest)
	}

	return s.Repo.Upsert(ctx, uid, data)
}
func (s *UserService) UpdateRole(ctx context.Context, uid string, role models.UserRole) error {
	allowedRoles := models.AllowedRoles()
	valid := false
	for _, r := range allowedRoles {
		if string(role) == r {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("UserService.UpdateRole: invalid role '%s'", role)
	}

	if err := s.Repo.UpdateField(ctx, uid, "role", string(role)); err != nil {
		return fmt.Errorf("UserService.UpdateRole: Firestore update failed: %w", err)
	}

	if s.AuthSvc != nil {
		if err := s.AuthSvc.SetRole(ctx, uid, string(role)); err != nil {
			fmt.Printf("Warning: failed to set Firebase custom claim for %s: %v\n", uid, err)
		}
	}
	return nil
}
func (s *UserService) Deactivate(ctx context.Context, uid string) error {
	return s.Repo.UpdateField(ctx, uid, "is_active", false)
}
func (s *UserService) ListUsers(ctx context.Context, limit, offset int) ([]models.UserProfile, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	snaps, err := s.Repo.List(ctx, limit, offset)
	if err != nil {
		return nil, err
	}

	profiles := make([]models.UserProfile, 0, len(snaps))
	for _, snap := range snaps {
		var u models.User
		if err := snap.DataTo(&u); err != nil {
			continue
		}
		profiles = append(profiles, u.ToProfile())
	}
	return profiles, nil
}
