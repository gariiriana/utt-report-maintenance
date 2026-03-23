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
type UserController struct {
	UserService *services.UserService
	AuditSvc    *services.AuditService
	NotifSvc    *services.NotificationService
}
func NewUserController(user *services.UserService, audit *services.AuditService, notif *services.NotificationService) *UserController {
	return &UserController{UserService: user, AuditSvc: audit, NotifSvc: notif}
}
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
func (c *UserController) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, err := c.UserService.ListUsers(ctx, 50, 0)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(users, nil))
}
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
