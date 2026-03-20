package controllers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

// UserController handles user management endpoints (admin only).
type UserController struct {
	UserService *services.UserService
	AuditSvc    *services.AuditService
	NotifSvc    *services.NotificationService
}

// NewUserController constructs a UserController.
func NewUserController(user *services.UserService, audit *services.AuditService, notif *services.NotificationService) *UserController {
	return &UserController{UserService: user, AuditSvc: audit, NotifSvc: notif}
}

// GetProfile handles GET /api/users/{uid} — admin retrieves any user's profile.
func (c *UserController) GetProfile(w http.ResponseWriter, r *http.Request) {
	uid := strings.TrimPrefix(r.URL.Path, "/api/users/")
	if uid == "" {
		helpers.SendAppError(w, apperrors.BadRequest("user UID is required"))
		return
	}

	ctx := r.Context()
	profile, err := c.UserService.GetProfile(ctx, uid)
	if err != nil {
		helpers.SendAppError(w, apperrors.NotFound("user"))
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(profile, nil))
}

// ListUsers handles GET /api/users — admin retrieves paginated user list.
func (c *UserController) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, err := c.UserService.ListUsers(ctx, 50, 0)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(users, nil))
}

// UpdateRole handles PATCH /api/users/{uid}/role — admin assigns a new role.
func (c *UserController) UpdateRole(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		helpers.SendAppError(w, apperrors.BadRequest("uid is required"))
		return
	}
	targetUID := parts[len(parts)-2]

	var body struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Role == "" {
		helpers.SendAppError(w, apperrors.BadRequest("role field is required"))
		return
	}

	ctx := r.Context()
	adminUID := middlewares.UIDFromContext(ctx)
	adminEmail := middlewares.EmailFromContext(ctx)
	adminRole := middlewares.RoleFromContext(ctx)
	requestID := helpers.ExtractRequestID(r)
	ip := helpers.GetClientIP(r)

	if err := c.UserService.UpdateRole(ctx, targetUID, models.UserRole(body.Role)); err != nil {
		c.AuditSvc.LogAction(ctx, models.ActionUpdate, adminUID, adminEmail, adminRole, "users", targetUID, requestID, ip, false, err.Error())
		helpers.SendAppError(w, apperrors.BadRequest(err.Error()))
		return
	}

	c.AuditSvc.LogAction(ctx, models.ActionUpdate, adminUID, adminEmail, adminRole, "users", targetUID, requestID, ip, true, "role updated to "+body.Role)
	c.NotifSvc.NotifyUserRoleChanged(ctx, targetUID, "", body.Role)

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "User role updated to " + body.Role,
	})
}

// Deactivate handles DELETE /api/users/{uid} — soft deactivate a user account.
func (c *UserController) Deactivate(w http.ResponseWriter, r *http.Request) {
	uid := strings.TrimPrefix(r.URL.Path, "/api/users/")
	if uid == "" {
		helpers.SendAppError(w, apperrors.BadRequest("user UID is required"))
		return
	}

	ctx := r.Context()
	if err := c.UserService.Deactivate(ctx, uid); err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "User deactivated",
	})
}
