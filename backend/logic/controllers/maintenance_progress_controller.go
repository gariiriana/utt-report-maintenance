package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/logic/models"
	"github.com/gariiriana/utt-report-maintenance/backend/logic/services"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

type MaintenanceProgressController struct {
	service services.IMaintenanceProgressService
}

func NewMaintenanceProgressController(service services.IMaintenanceProgressService) *MaintenanceProgressController {
	return &MaintenanceProgressController{service: service}
}

func (c *MaintenanceProgressController) CreateProgress(w http.ResponseWriter, r *http.Request) {
	var req models.MaintenanceProgress
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	id, err := c.service.CreateProgress(r.Context(), req)
	if err != nil {
		logger.Error("maintenance_create_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to create maintenance progress", http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusCreated, map[string]string{"id": id, "message": "Maintenance item created successfully"})
}

func (c *MaintenanceProgressController) DeleteProgress(w http.ResponseWriter, r *http.Request) {
	id := helpers.ExtractParam(r, "id")
	if id == "" {
		helpers.SendError(w, "Missing ID", http.StatusBadRequest)
		return
	}

	if err := c.service.DeleteProgress(r.Context(), id); err != nil {
		logger.Error("maintenance_delete_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to delete maintenance progress", http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]string{"message": "Maintenance item deleted successfully"})
}

func (c *MaintenanceProgressController) ListAll(w http.ResponseWriter, r *http.Request) {
	yearStr := r.URL.Query().Get("year")
	quarter := r.URL.Query().Get("quarter")
	
	year, _ := strconv.Atoi(yearStr)
	logger.Info("maintenance_list_all", "year", year, "quarter", quarter, "yearStr", yearStr)

	progress, err := c.service.ListAll(r.Context(), year, quarter)
	if err != nil {
		logger.Error("maintenance_progress_list_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to list maintenance progress", http.StatusInternalServerError)
		return
	}
	helpers.SendJSON(w, http.StatusOK, progress)
}

func (c *MaintenanceProgressController) GetSummary(w http.ResponseWriter, r *http.Request) {
	yearStr := r.URL.Query().Get("year")
	quarter := r.URL.Query().Get("quarter")
	
	year, _ := strconv.Atoi(yearStr)
	logger.Info("maintenance_get_summary", "year", year, "quarter", quarter, "yearStr", yearStr)

	summary, err := c.service.GetSummary(r.Context(), year, quarter)
	if err != nil {
		logger.Error("maintenance_summary_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to get maintenance summary", http.StatusInternalServerError)
		return
	}
	helpers.SendJSON(w, http.StatusOK, summary)
}

func (c *MaintenanceProgressController) EndDay(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := c.service.EndDay(ctx); err != nil {
		logger.LogSecurityEvent("end_day_failed", r.Header.Get("X-Request-Id"), helpers.GetClientIP(r), err.Error())
		helpers.SendJSON(w, http.StatusInternalServerError, models.BuildAPIResponse(nil, err.Error()))
		return
	}

	helpers.SendJSON(w, http.StatusOK, models.BuildAPIResponse(map[string]string{"message": "Daily progress frozen successfully"}, nil))
}

func (c *MaintenanceProgressController) UpdateProgress(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		helpers.SendError(w, "Invalid maintenance progress ID", http.StatusBadRequest)
		return
	}
	id := parts[3]

	var req struct {
		ActualQty float64 `json:"actual_qty"`
		Remark    string  `json:"remark"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := c.service.UpdateProgress(r.Context(), id, req.ActualQty, req.Remark); err != nil {
		logger.Error("maintenance_update_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to update maintenance progress", http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]string{"message": "Progress updated successfully"})
}
