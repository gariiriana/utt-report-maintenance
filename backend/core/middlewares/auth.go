package middlewares

import (
	"context"
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
)

type contextKey string

const (
	claimsKey    contextKey = "firebase_claims"
	userUIDKey   contextKey = "user_uid"
	userEmailKey contextKey = "user_email"
	userRoleKey  contextKey = "user_role"
)

// Exported aliases for use in other packages (e.g., WebSocket auth in routes)
var (
	ClaimsKeyExported    = claimsKey
	UserUIDKeyExported   = userUIDKey
	UserEmailKeyExported = userEmailKey
	UserRoleKeyExported  = userRoleKey
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
// FaceExemptEmails: akun yang tidak wajib scan wajah. Samakan dengan FACE_EXEMPT_EMAILS
// di frontend/types/faceAuthTypes.ts, functions/src/face-session.ts dan firebase/firestore.rules.
var FaceExemptEmails = map[string]bool{"qcdme@dme.com": true}

// faceExemptPaths boleh diakses sebelum scan wajah. Logout TIDAK termasuk: endpoint itu
// mencabut token akun, jadi tidak boleh dipicu oleh pemegang password saja.
var faceExemptPaths = map[string]bool{"/api/auth/me": true, "/api/auth/login": true}

// IsFaceGatePath: endpoint gerbang scan wajah (/api/face/*) dipakai SEBELUM punya sesi
// wajah, jadi dikecualikan dari cek sesi wajah dan pembatasan role. Endpoint admin di
// dalamnya mengecek sesi wajah reviewer sendiri (FaceService.requireReviewer).
func IsFaceGatePath(path string) bool {
	return strings.HasPrefix(path, "/api/face/")
}

// Cache status profil wajah per instance (hemat kuota baca Firestore paket Spark). Wajah
// yang dihapus QC paling lama faceStatusTTL masih lolos di backend Go instance lain;
// Firestore rules tetap menolaknya seketika. InvalidateFaceStatus dipanggil saat QC
// mengubah/menghapus profil di instance yang sama.
const faceStatusTTL = 60 * time.Second

type faceStatusEntry struct {
	status  string
	expires time.Time
}

var (
	faceStatusMu    sync.Mutex
	faceStatusCache = map[string]faceStatusEntry{}
)

func InvalidateFaceStatus(faceID string) {
	faceStatusMu.Lock()
	delete(faceStatusCache, faceID)
	faceStatusMu.Unlock()
}

// Status sesi wajah perangkat ini.
const (
	FaceSessionActive  = "active"
	FaceSessionExpired = "expired" // 12 jam habis: cukup scan ulang
	FaceSessionRevoked = "revoked" // wajahnya dihapus/tidak disetujui lagi oleh QC
)

type faceRecheckKey struct{}

// WithFaceRecheck menyimpan fungsi cek ulang sesi wajah di context, untuk koneksi
// berumur panjang (WebSocket voice) yang harus diputus saat wajah dihapus/sesi habis.
func WithFaceRecheck(ctx context.Context, fs *firestore.Client, token *firebaseAuth.Token) context.Context {
	return context.WithValue(ctx, faceRecheckKey{}, func(c context.Context) bool {
		return HasValidFaceSession(c, fs, token)
	})
}

// FaceRecheckFromContext mengambil fungsi cek ulang dari WithFaceRecheck (nil jika tidak ada).
func FaceRecheckFromContext(ctx context.Context) func(context.Context) bool {
	f, _ := ctx.Value(faceRecheckKey{}).(func(context.Context) bool)
	return f
}

// FaceSessionState: apakah sesi perangkat ini lolos scan wajah (klaim faceUntil/faceId dari
// POST /api/face/verify) dan profil wajahnya masih disetujui QC. Wajah yang dihapus langsung
// tidak sah tanpa mengganggu rekan yang memakai akun yang sama. Error dikembalikan hanya untuk
// gangguan Firestore (bukan dokumen tidak ada), agar pemanggil bisa mencoba lagi.
// Logika sama dengan hasFaceSession di firestore.rules. Lihat scanning.md.
func FaceSessionState(ctx context.Context, fs *firestore.Client, token *firebaseAuth.Token) (string, error) {
	email, _ := token.Claims["email"].(string)
	if FaceExemptEmails[strings.ToLower(email)] {
		return FaceSessionActive, nil
	}
	until, _ := token.Claims["faceUntil"].(float64)
	if int64(until) <= time.Now().Unix() {
		return FaceSessionExpired, nil
	}
	faceID, _ := token.Claims["faceId"].(string)
	if faceID == "break-glass" {
		return FaceSessionActive, nil // dibatasi 2 jam oleh faceUntil
	}
	if faceID == "" || fs == nil {
		return FaceSessionRevoked, nil
	}
	faceStatusMu.Lock()
	cached, ok := faceStatusCache[faceID]
	faceStatusMu.Unlock()
	status := cached.status
	if !ok || time.Now().After(cached.expires) {
		snap, err := fs.Collection("face_profiles").Doc(faceID).Get(ctx)
		switch {
		case snap != nil && !snap.Exists():
			status = "deleted"
		case err != nil:
			return "", err
		default:
			status, _ = snap.Data()["status"].(string)
		}
		faceStatusMu.Lock()
		if len(faceStatusCache) > 5000 {
			faceStatusCache = map[string]faceStatusEntry{}
		}
		faceStatusCache[faceID] = faceStatusEntry{status: status, expires: time.Now().Add(faceStatusTTL)}
		faceStatusMu.Unlock()
	}
	if status == "approved" {
		return FaceSessionActive, nil
	}
	return FaceSessionRevoked, nil
}

// HasValidFaceSession: true hanya jika sesi wajah aktif (gagal tertutup saat Firestore error).
func HasValidFaceSession(ctx context.Context, fs *firestore.Client, token *firebaseAuth.Token) bool {
	state, err := FaceSessionState(ctx, fs, token)
	return err == nil && state == FaceSessionActive
}

func RequireFirebaseAuth(authClient *firebaseAuth.Client, fs *firestore.Client) func(http.Handler) http.Handler {
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

			if !faceExemptPaths[r.URL.Path] && !IsFaceGatePath(r.URL.Path) && !HasValidFaceSession(r.Context(), fs, decoded) {
				logger.LogSecurityEvent("face_session_required", r.Header.Get("X-Request-Id"), helpers.GetClientIP(r), decoded.UID)
				helpers.SendError(w, "Forbidden: face verification required", http.StatusForbidden)
				return
			}

			ctx := WithFaceRecheck(r.Context(), fs, decoded)
			ctx = context.WithValue(ctx, claimsKey, decoded)
			ctx = context.WithValue(ctx, userUIDKey, decoded.UID)
			if email, ok := decoded.Claims["email"].(string); ok {
				ctx = context.WithValue(ctx, userEmailKey, email)
			}
			if role, ok := decoded.Claims["role"].(string); ok {
				ctx = context.WithValue(ctx, userRoleKey, role)
				// Drafter uses Firestore/Storage directly; unrelated backend modules are restricted.
				// Gerbang scan wajah tetap terbuka agar drafter bisa lolos 2FA.
				if role == "drafter" && !IsFaceGatePath(r.URL.Path) && r.URL.Path != "/api/auth/me" && r.URL.Path != "/api/auth/logout" && r.URL.Path != "/api/auth/login" {
					helpers.SendError(w, "Forbidden: Drafter access is limited to files and BOQ", http.StatusForbidden)
					return
				}
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
