package middlewares

import (
	"context"
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)
type contextKey string

const (
	claimsKey    contextKey = "firebase_claims"
	userUIDKey   contextKey = "user_uid"
	userEmailKey contextKey = "user_email"
	userRoleKey  contextKey = "user_role"
)

// VerifySecret checks the client-provided API secret against the server secret.
// SECURITY: fail-closed — returns false if BACKEND_API_SECRET is not set.
// Uses crypto/subtle.ConstantTimeCompare to prevent timing side-channel attacks.
func VerifySecret(clientSecret string) bool {
	serverSecret := os.Getenv("BACKEND_API_SECRET")
	if serverSecret == "" {
		// Fail-closed: if secret is not configured, reject all requests
		logger.LogSecurityEvent("api_secret_not_configured", "", "", "BACKEND_API_SECRET env var is empty — all requests rejected")
		return false
	}
	return subtle.ConstantTimeCompare([]byte(clientSecret), []byte(serverSecret)) == 1
}
func RequireAPISecret(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secret := r.Header.Get("X-API-Secret")
		if !VerifySecret(secret) {
			logger.LogSecurityEvent("invalid_api_secret", r.Header.Get("X-Request-Id"), helpers.GetClientIP(r), "X-API-Secret mismatch")
			helpers.SendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func RequireFirebaseAuth(authClient *firebaseAuth.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			token, ok := extractBearer(authHeader)
			if !ok {
				helpers.SendError(w, "Unauthorized: missing or malformed Authorization header", http.StatusUnauthorized)
				return
			}

			decoded, err := authClient.VerifyIDToken(r.Context(), token)
			if err != nil {
				logger.LogSecurityEvent("invalid_firebase_token", r.Header.Get("X-Request-Id"), helpers.GetClientIP(r), err.Error())
				helpers.SendError(w, "Unauthorized: invalid ID token", http.StatusUnauthorized)
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, claimsKey, decoded)
			ctx = context.WithValue(ctx, userUIDKey, decoded.UID)
			if email, ok := decoded.Claims["email"].(string); ok {
				ctx = context.WithValue(ctx, userEmailKey, email)
			}
			if role, ok := decoded.Claims["role"].(string); ok {
				ctx = context.WithValue(ctx, userRoleKey, role)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(userRoleKey).(string)
			if !allowed[role] {
				logger.LogSecurityEvent("insufficient_role", r.Header.Get("X-Request-Id"), helpers.GetClientIP(r),
					"required: "+strings.Join(roles, "|")+" got: "+role)
				helpers.SendError(w, "Forbidden: insufficient role", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
func ClaimsFromContext(ctx context.Context) (*firebaseAuth.Token, bool) {
	t, ok := ctx.Value(claimsKey).(*firebaseAuth.Token)
	return t, ok
}
func UIDFromContext(ctx context.Context) string {
	uid, _ := ctx.Value(userUIDKey).(string)
	return uid
}
func EmailFromContext(ctx context.Context) string {
	email, _ := ctx.Value(userEmailKey).(string)
	return email
}
func RoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(userRoleKey).(string)
	return role
}
func extractBearer(header string) (string, bool) {
	const prefix = "Bearer "
	if header == "" || len(header) <= len(prefix) || !strings.HasPrefix(header, prefix) {
		return "", false
	}
	return header[len(prefix):], true
}
