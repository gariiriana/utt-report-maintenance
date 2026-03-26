package helpers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
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
func SendAppError(w http.ResponseWriter, err *apperrors.AppError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.StatusCode)
	
	resp := map[string]interface{}{
		"status":  "error",
		"code":    err.Code,
		"message": err.Message,
	}
	if ve, ok := err.Err.(*apperrors.ValidationError); ok {
		resp["fields"] = ve.Fields
	} else if err.Details != "" {
		resp["details"] = err.Details
	}

	json.NewEncoder(w).Encode(resp)
}
func SendValidationError(w http.ResponseWriter, err *apperrors.ValidationError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnprocessableEntity)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "error",
		"code":    apperrors.ErrCodeInvalidPayload,
		"message": "Validation failed",
		"fields":  err.Fields,
	})
}
func SendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, "json encoding error", http.StatusInternalServerError)
	}
}
func SendNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
func ExtractRequestID(r *http.Request) string {
	return r.Header.Get("X-Request-Id")
}
func ExtractParam(r *http.Request, key string) string {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
}
func GetClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		addr = addr[:idx]
	}
	return addr
}
