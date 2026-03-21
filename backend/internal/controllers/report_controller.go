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

// ReportController handles HTTP requests related to reports.
type ReportController struct {
	Service      *services.ReportService
	AuditService *services.AuditService
	NotifService *services.NotificationService
}

// NewReportController constructs a ReportController.
func NewReportController(service *services.ReportService, audit *services.AuditService, notif *services.NotificationService) *ReportController {
	return &ReportController{Service: service, AuditService: audit, NotifService: notif}
}

// HandleReport handles POST /api/report — save a new report document.
// @Summary Create a new report
// @Description Save a new report document to the specified collection.
// @Tags reports
// @Accept  json
// @Produce  json
// @Param   X-API-Secret  header  string  true  "API Secret"
// @Param   Authorization header  string  true  "Firebase JWT Token (Bearer)"
// @Param   report body models.CreateReportRequest true "Report data"
// @Success 200 {object} models.SuccessResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 401 {object} models.ErrorResponse
// @Failure 403 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/report [post]
func (c *ReportController) HandleReport(w http.ResponseWriter, r *http.Request) {
	var req models.CreateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendAppError(w, apperrors.BadRequest("Invalid request body"))
		return
	}

	// Validate the request struct
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
		// Check if it's an unauthorized collection error
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
	
	// Use the new helper for success response
	helpers.SendJSON(w, http.StatusOK, models.BuildSuccessResponse(reportID, collectionName, "Data saved successfully via Clean Architecture!"))
}

// GetReport handles GET /api/report/{collection}/{id}.
// @Summary Get a report by ID
// @Description Retrieve a single report document from a specific collection.
// @Tags reports
// @Produce  json
// @Param   X-API-Secret  header  string  true  "API Secret"
// @Param   Authorization header  string  true  "Firebase JWT Token (Bearer)"
// @Param   collection path string true "Collection name (e.g., hse)"
// @Param   id path string true "Report ID"
// @Success 200 {object} models.SuccessResponse
// @Failure 404 {object} models.ErrorResponse
// @Router /api/report/{collection}/{id} [get]
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

// ListReports handles GET /api/reports/{collection}.
// @Summary List reports in a collection
// @Description Retrieve a list of reports from a specific collection.
// @Tags reports
// @Produce  json
// @Param   X-API-Secret  header  string  true  "API Secret"
// @Param   Authorization header  string  true  "Firebase JWT Token (Bearer)"
// @Param   collection query string false "Collection name (defaults to hse)"
// @Success 200 {array} models.SuccessResponse
// @Router /api/reports [get]
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

// DeleteReport handles DELETE /api/report/{collection}/{id}.
// @Summary Delete a report
// @Description Remove a report document from the specified collection.
// @Tags reports
// @Param   X-API-Secret  header  string  true  "API Secret"
// @Param   Authorization header  string  true  "Firebase JWT Token (Bearer)"
// @Param   collection path string true "Collection name"
// @Param   id path string true "Report ID"
// @Success 204 "No Content"
// @Router /api/report/{collection}/{id} [delete]
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
