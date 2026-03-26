package controllers

import (
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type AuditController struct {
	AuditService *services.AuditService
}
func NewAuditController(auditSvc *services.AuditService) *AuditController {
	return &AuditController{AuditService: auditSvc}
}
func (c *AuditController) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middlewares.RoleFromContext(ctx)
	if role != "admin" {
		helpers.SendAppError(w, apperrors.Forbidden("audit logs require admin role"))
		return
	}

	logs, err := c.AuditService.GetAll(ctx, 100)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"data":   logs,
		"count":  len(logs),
	})
}
func (c *AuditController) GetMyAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := middlewares.UIDFromContext(ctx)
	if uid == "" {
		helpers.SendAppError(w, apperrors.Unauthorized("authentication required"))
		return
	}

	logs, err := c.AuditService.GetByUser(ctx, uid, 50)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"data":   logs,
	})
}
