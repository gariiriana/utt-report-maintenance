package services

import (
	"context"
	"fmt"
	"time"

	firebaseAuth "firebase.google.com/go/v4/auth"
)
type AuthService struct {
	AuthClient *firebaseAuth.Client
}
func NewAuthService(client *firebaseAuth.Client) *AuthService {
	return &AuthService{AuthClient: client}
}
func (s *AuthService) VerifyIDToken(ctx context.Context, idToken string) (*firebaseAuth.Token, error) {
	token, err := s.AuthClient.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("AuthService.VerifyIDToken: %w", err)
	}
	return token, nil
}
func (s *AuthService) GetUser(ctx context.Context, uid string) (*firebaseAuth.UserRecord, error) {
	user, err := s.AuthClient.GetUser(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("AuthService.GetUser(%s): %w", uid, err)
	}
	return user, nil
}
func (s *AuthService) SetCustomClaims(ctx context.Context, uid string, claims map[string]interface{}) error {
	if err := s.AuthClient.SetCustomUserClaims(ctx, uid, claims); err != nil {
		return fmt.Errorf("AuthService.SetCustomClaims(%s): %w", uid, err)
	}
	return nil
}
func (s *AuthService) SetRole(ctx context.Context, uid, role string) error {
	return s.SetCustomClaims(ctx, uid, map[string]interface{}{
		"role":       role,
		"updated_at": time.Now().UTC().Unix(),
	})
}
func (s *AuthService) RevokeRefreshTokens(ctx context.Context, uid string) error {
	if err := s.AuthClient.RevokeRefreshTokens(ctx, uid); err != nil {
		return fmt.Errorf("AuthService.RevokeRefreshTokens(%s): %w", uid, err)
	}
	return nil
}
func (s *AuthService) ListUsers(ctx context.Context, maxResults int) ([]*firebaseAuth.ExportedUserRecord, error) {
	var users []*firebaseAuth.ExportedUserRecord
	iter := s.AuthClient.Users(ctx, "")
	for i := 0; i < maxResults; i++ {
		user, err := iter.Next()
		if err != nil {
			break
		}
		users = append(users, user)
	}
	return users, nil
}
func (s *AuthService) DeleteUser(ctx context.Context, uid string) error {
	if err := s.AuthClient.DeleteUser(ctx, uid); err != nil {
		return fmt.Errorf("AuthService.DeleteUser(%s): %w", uid, err)
	}
	return nil
}
