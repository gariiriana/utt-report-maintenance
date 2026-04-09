package crypto

import (
	"context"
	"fmt"
	"time"

	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)
type FirebaseTokenVerifier struct {
	client *firebaseAuth.Client
}
type FirebaseClaims struct {
	UID           string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
	Role          string
	ExpiresAt     time.Time
}
func NewFirebaseTokenVerifier(ctx context.Context, credentialsJSON []byte) (*FirebaseTokenVerifier, error) {
	opt := option.WithCredentialsJSON(credentialsJSON)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("firebase app init failed: %w", err)
	}

	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase auth client init failed: %w", err)
	}

	return &FirebaseTokenVerifier{client: client}, nil
}
func (v *FirebaseTokenVerifier) Verify(ctx context.Context, idToken string) (*FirebaseClaims, error) {
	decoded, err := v.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("token verification failed: %w", err)
	}

	claims := &FirebaseClaims{
		UID:       decoded.UID,
		ExpiresAt: time.Unix(decoded.Expires, 0).UTC(),
	}

	if email, ok := decoded.Claims["email"].(string); ok {
		claims.Email = email
	}
	if verified, ok := decoded.Claims["email_verified"].(bool); ok {
		claims.EmailVerified = verified
	}
	if name, ok := decoded.Claims["name"].(string); ok {
		claims.Name = name
	}
	if picture, ok := decoded.Claims["picture"].(string); ok {
		claims.Picture = picture
	}
	if role, ok := decoded.Claims["role"].(string); ok {
		claims.Role = role
	}

	return claims, nil
}
func (c *FirebaseClaims) IsAdmin() bool {
	return c.Role == "admin"
}
func (c *FirebaseClaims) IsHSE() bool {
	return c.Role == "hse" || c.Role == "admin"
}
func (c *FirebaseClaims) HasRole(role string) bool {
	return c.Role == role || c.Role == "admin"
}
func ExtractBearerToken(authHeader string) (string, bool) {
	const prefix = "Bearer "
	if len(authHeader) <= len(prefix) {
		return "", false
	}
	if authHeader[:len(prefix)] != prefix {
		return "", false
	}
	return authHeader[len(prefix):], true
}
