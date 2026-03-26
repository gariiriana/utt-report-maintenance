package controllers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/logic/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/logic/models"
	"github.com/gariiriana/utt-report-maintenance/backend/logic/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type ReportController struct {
	Service      *services.ReportService
	AuditService *services.AuditService
	NotifService *services.NotificationService
}
func NewReportController(service *services.ReportService, audit *services.AuditService, notif *services.NotificationService) *ReportController {
	return &ReportController{Service: service, AuditService: audit, NotifService: notif}
}
func (c *ReportController) HandleReport(w http.ResponseWriter, r *http.Request) {
	var req models.CreateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendAppError(w, apperrors.BadRequest("Invalid request body"))
		return
	}
	if err := helpers.ValidateStruct(&req); err != nil {
		helpers.SendAppError(w, err)
		return
	}

	ctx := r.Context()
	uid := middlewares.UIDFromContext(ctx)
	email := middlewares.EmailFromContext(ctx)
	role := middlewares.RoleFromContext(ctx)
	requestID := middlewares.GetRequestID(ctx)
	ip := helpers.GetClientIP(r)

	reportID, collectionName, err := c.Service.ProcessReport(ctx, &req)
	if err != nil {
		if strings.HasPrefix(err.Error(), "unauthorized collection") {
			c.AuditService.LogAction(ctx, models.ActionDeny, uid, email, role, "", "", requestID, ip, false, err.Error())
			helpers.SendAppError(w, apperrors.Forbidden(err.Error()))
		} else {
			c.AuditService.LogAction(ctx, models.ActionCreate, uid, email, role, "", "", requestID, ip, false, err.Error())
			helpers.SendAppError(w, apperrors.Internal(err))
		}
		return
	}

	c.AuditService.LogAction(ctx, models.ActionCreate, uid, email, role, collectionName, reportID, requestID, ip, true, "")
	c.NotifService.NotifyReportCreated(ctx, collectionName, reportID, uid)
	helpers.SendJSON(w, http.StatusOK, models.BuildSuccessResponse(reportID, collectionName, "Data saved successfully via Clean Architecture!"))
}
func (c *ReportController) GetReport(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 2 {
		helpers.SendAppError(w, apperrors.BadRequest("collection and id path parameters are required"))
		return
	}
	collection := parts[len(parts)-2]
	docID := parts[len(parts)-1]

	ctx := r.Context()
	data, err := c.Service.GetReport(ctx, collection, docID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			helpers.SendAppError(w, apperrors.NotFound("report"))
		} else {
			helpers.SendAppError(w, apperrors.Internal(err))
		}
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(data, nil))
}
func (c *ReportController) ListReports(w http.ResponseWriter, r *http.Request) {
	collection := r.URL.Query().Get("collection")
	if collection == "" {
		collection = string(models.ReportTypeHSE)
	}

	ctx := r.Context()
	reports, err := c.Service.ListReports(ctx, collection, 20, 0)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(reports, nil))
}
func (c *ReportController) DeleteReport(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 2 {
		helpers.SendAppError(w, apperrors.BadRequest("collection and id are required"))
		return
	}
	collection := parts[len(parts)-2]
	docID := parts[len(parts)-1]

	ctx := r.Context()
	uid := middlewares.UIDFromContext(ctx)
	email := middlewares.EmailFromContext(ctx)
	role := middlewares.RoleFromContext(ctx)
	requestID := middlewares.GetRequestID(ctx)
	ip := helpers.GetClientIP(r)

	if err := c.Service.DeleteReport(ctx, collection, docID); err != nil {
		c.AuditService.LogAction(ctx, models.ActionDelete, uid, email, role, collection, docID, requestID, ip, false, err.Error())
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	c.AuditService.LogAction(ctx, models.ActionDelete, uid, email, role, collection, docID, requestID, ip, true, "")
	c.NotifService.NotifyReportDeleted(ctx, collection, docID, uid)
	helpers.SendNoContent(w)
}
