package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type AuthController struct {
	AuthService *services.AuthService
	UserService *services.UserService
	AuditSvc    *services.AuditService
}
func NewAuthController(auth *services.AuthService, user *services.UserService, audit *services.AuditService) *AuthController {
	return &AuthController{AuthService: auth, UserService: user, AuditSvc: audit}
}
func (c *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
		helpers.SendAppError(w, apperrors.BadRequest("id_token is required"))
		return
	}

	ctx := r.Context()
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
