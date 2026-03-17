package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/internal/services"
	"github.com/gariiriana/utt-report-maintenance/pkg/helpers"
)

type ReportController struct {
	Service *services.ReportService
}

func NewReportController(service *services.ReportService) *ReportController {
	return &ReportController{Service: service}
}

func (c *ReportController) HandleReport(w http.ResponseWriter, r *http.Request) {
	var requestBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		helpers.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// The context from the request should be passed down
	ctx := r.Context()
	
	reportID, collectionName, err := c.Service.ProcessReport(ctx, requestBody)
	if err != nil {
		// Differentiate between user error (bad collection name) and server error based on exact match or error type
		if err.Error()[:23] == "unauthorized collection" {
			helpers.SendError(w, err.Error(), http.StatusForbidden)
		} else {
			helpers.SendError(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	helpers.SendSuccess(w, reportID, collectionName, "Data saved to "+collectionName+" via Clean Architecture Backend!")
}
