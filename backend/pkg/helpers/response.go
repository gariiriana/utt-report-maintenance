package helpers

import (
	"encoding/json"
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/api/internal/models"
)

func SendSuccess(w http.ResponseWriter, reportID, collection, message string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.SuccessResponse{
		Status:     "success",
		ReportID:   reportID,
		Collection: collection,
		Message:    message,
	})
}

func SendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Status:  "error",
		Message: message,
	})
}
