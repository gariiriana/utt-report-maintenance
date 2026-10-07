// ============================================================================
// FILE: backend/core/controllers/auth_controller.go
// Deskripsi: Controller Autentikasi Backend Go.
//            Menangani request Login, Verifikasi ID Token Firebase, Proxy Login Fallback,
//            Verifikasi Turnstile CAPTCHA, Logout, serta Logging Audit Trail ke Firestore.
// ============================================================================

package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"

	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	apperrors "github.com/gariiriana/DwimitraSystem/backend/pkg/errors"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
)

// Struct AuthController menampung pointer layanan backend (Services)
type AuthController struct {
	AuthService  *services.AuthService
	UserService  *services.UserService
	AuditSvc     *services.AuditService
	TurnstileSvc *services.TurnstileService
}

// Constructor AuthController
func NewAuthController(auth *services.AuthService, user *services.UserService, audit *services.AuditService, turnstile *services.TurnstileService) *AuthController {
	return &AuthController{AuthService: auth, UserService: user, AuditSvc: audit, TurnstileSvc: turnstile}
}

// Endpoint: POST /api/auth/login
// Memverifikasi ID Token Firebase & memverifikasi Turnstile CAPTCHA jika dilampirkan
func (c *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken        string `json:"id_token"`
		TurnstileToken string `json:"turnstile_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
		helpers.SendAppError(w, apperrors.BadRequest("id_token is required"))
		return
	}

	ctx := r.Context()

	// Verifikasi opsional token Turnstile CAPTCHA
	if body.TurnstileToken != "" && c.TurnstileSvc != nil {
		clientIP := helpers.GetClientIP(r)
		valid, err := c.TurnstileSvc.Verify(ctx, body.TurnstileToken, clientIP)
		if err != nil || !valid {
			helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeUnauthorized, "turnstile security verification failed"))
			return
		}
	}
	token, err := c.AuthService.VerifyIDToken(ctx, body.IDToken)
	if err != nil {
		helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeInvalidToken, "invalid or expired ID token"))
		return
	}

	email, _ := token.Claims["email"].(string)
	displayName, _ := token.Claims["name"].(string)
	photoURL, _ := token.Claims["picture"].(string)

	// Sinkronisasi data profil user ke Firestore database
	_ = c.UserService.UpsertFromLogin(ctx, token.UID, email, displayName, photoURL)

	// Catat log aktivitas login ke Audit Trail
	requestID := helpers.ExtractRequestID(r)
	ip := helpers.GetClientIP(r)
	c.AuditSvc.LogAction(ctx, models.ActionLogin, token.UID, email, "", "", "", requestID, ip, true, "")

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"uid":     token.UID,
		"email":   email,
		"message": "Login recorded successfully",
	})
}

// Endpoint: GET /api/auth/me
// Mengambil profil data user aktif berdasarkan ID token yang terautentikasi
func (c *AuthController) Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := middlewares.UIDFromContext(ctx)
	if uid == "" {
		helpers.SendAppError(w, apperrors.Unauthorized("authentication required"))
		return
	}

	profile, err := c.UserService.GetProfile(ctx, uid)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(profile, nil))
}

// Endpoint: POST /api/auth/logout
// Melakukan pembatalan refresh token Firebase & mencatat aktivitas logout
func (c *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := middlewares.UIDFromContext(ctx)
	if uid == "" {
		helpers.SendAppError(w, apperrors.Unauthorized("authentication required"))
		return
	}

	if err := c.AuthService.RevokeRefreshTokens(ctx, uid); err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}

	email := middlewares.EmailFromContext(ctx)
	requestID := helpers.ExtractRequestID(r)
	ip := helpers.GetClientIP(r)
	c.AuditSvc.LogAction(ctx, models.ActionLogout, uid, email, "", "", "", requestID, ip, true, "")

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Logged out and tokens revoked successfully",
	})
}

// Struct payload request Proxy Login Fallback
type ProxyLoginRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	TurnstileToken string `json:"turnstile_token"`
}

// Struct response Identity Toolkit API Google Firebase
type IdentityToolkitResponse struct {
	Kind         string `json:"kind"`
	LocalID      string `json:"localId"`
	Email        string `json:"email"`
	DisplayName  string `json:"displayName"`
	IDToken      string `json:"idToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    string `json:"expiresIn"`
	Error        *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Endpoint: POST /api/auth/proxy-login
// Fallback backend login saat koneksi langsung browser ke Firebase Identity Toolkit terhalang adblocker/firewall
func (c *AuthController) ProxyLogin(w http.ResponseWriter, r *http.Request) {
	var body ProxyLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Password == "" {
		helpers.SendAppError(w, apperrors.BadRequest("email and password are required"))
		return
	}

	ctx := r.Context()

	// Verifikasi token Turnstile CAPTCHA jika ada
	if body.TurnstileToken != "" && c.TurnstileSvc != nil {
		clientIP := helpers.GetClientIP(r)
		valid, err := c.TurnstileSvc.Verify(ctx, body.TurnstileToken, clientIP)
		if err != nil || !valid {
			helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeUnauthorized, "turnstile security verification failed"))
			return
		}
	}

	apiKey := os.Getenv("FIREBASE_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("VITE_FIREBASE_API_KEY")
	}
	if apiKey == "" {
		apiKey = "AIzaSyAkhsPf9KzIq9B7L_P33g-6wN3M7QHXCbs"
	}

	reqPayload, _ := json.Marshal(map[string]interface{}{
		"email":             body.Email,
		"password":          body.Password,
		"returnSecureToken": true,
	})

	url := "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + apiKey
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqPayload))
	if err != nil {
		helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeInternal, "failed to connect to identity service"))
		return
	}
	defer resp.Body.Close()

	var idResp IdentityToolkitResponse
	if err := json.NewDecoder(resp.Body).Decode(&idResp); err != nil {
		helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeInternal, "failed to parse identity response"))
		return
	}

	if idResp.Error != nil && idResp.Error.Message != "" {
		msg := "Email atau password salah"
		if idResp.Error.Message == "TOO_MANY_ATTEMPTS_TRY_LATER" {
			msg = "Terlalu banyak percobaan login. Coba lagi nanti."
		}
		helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeUnauthorized, msg))
		return
	}

	if idResp.LocalID == "" {
		helpers.SendAppError(w, apperrors.New(apperrors.ErrCodeUnauthorized, "Email atau password salah"))
		return
	}

	// Generate Custom Token Firebase dari server
	customToken, _ := c.AuthService.CreateCustomToken(ctx, idResp.LocalID)
	_ = c.UserService.UpsertFromLogin(ctx, idResp.LocalID, idResp.Email, idResp.DisplayName, "")

	requestID := helpers.ExtractRequestID(r)
	ip := helpers.GetClientIP(r)
	c.AuditSvc.LogAction(ctx, models.ActionLogin, idResp.LocalID, idResp.Email, "", "", "", requestID, ip, true, "proxy_fallback")

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "success",
		"uid":          idResp.LocalID,
		"email":        idResp.Email,
		"customToken":  customToken,
		"idToken":      idResp.IDToken,
		"refreshToken": idResp.RefreshToken,
	})
}
