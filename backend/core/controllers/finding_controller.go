package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
)

// FindingController handles HTTP requests for findings.
type FindingController struct {
	service services.IFindingService
}

func NewFindingController(service services.IFindingService) *FindingController {
	return &FindingController{service: service}
}

func (c *FindingController) CreateFinding(w http.ResponseWriter, r *http.Request) {
	var req models.Finding
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.PartName == "" || req.PartNumber == "" {
		helpers.SendError(w, "Part name and part number are required", http.StatusBadRequest)
		return
	}

	id, err := c.service.CreateFinding(r.Context(), req)
	if err != nil {
		logger.Error("finding_create_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to create finding", http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusCreated, map[string]string{"id": id, "message": "Finding created successfully"})
}

func (c *FindingController) ListFindings(w http.ResponseWriter, r *http.Request) {
	findings, err := c.service.ListFindings(r.Context())
	if err != nil {
		logger.Error("finding_list_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to list findings", http.StatusInternalServerError)
		return
	}
	helpers.SendJSON(w, http.StatusOK, findings)
}

func (c *FindingController) DeleteFinding(w http.ResponseWriter, r *http.Request) {
	id := helpers.ExtractParam(r, "id")
	if id == "" {
		helpers.SendError(w, "Missing finding ID", http.StatusBadRequest)
		return
	}

	if err := c.service.DeleteFinding(r.Context(), id); err != nil {
		logger.Error("finding_delete_error", "request_id", helpers.ExtractRequestID(r), "error", err.Error())
		helpers.SendError(w, "Failed to delete finding", http.StatusInternalServerError)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]string{"message": "Finding deleted successfully"})
}
