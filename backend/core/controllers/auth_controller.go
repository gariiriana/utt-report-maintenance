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
type AuthController struct {
	AuthService  *services.AuthService
	UserService  *services.UserService
	AuditSvc     *services.AuditService
	TurnstileSvc *services.TurnstileService
}
func NewAuthController(auth *services.AuthService, user *services.UserService, audit *services.AuditService, turnstile *services.TurnstileService) *AuthController {
	return &AuthController{AuthService: auth, UserService: user, AuditSvc: audit, TurnstileSvc: turnstile}
}
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

	// Optional/Conditional Turnstile token verification
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
	_ = c.UserService.UpsertFromLogin(ctx, token.UID, email, displayName, photoURL)

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

type ProxyLoginRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	TurnstileToken string `json:"turnstile_token"`
}

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

func (c *AuthController) ProxyLogin(w http.ResponseWriter, r *http.Request) {
	var body ProxyLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Password == "" {
		helpers.SendAppError(w, apperrors.BadRequest("email and password are required"))
		return
	}

	ctx := r.Context()

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

