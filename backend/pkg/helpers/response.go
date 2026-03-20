package helpers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
)

// SendSuccess writes a 200 JSON success response.
func SendSuccess(w http.ResponseWriter, reportID, collection, message string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.SuccessResponse{
		Status:     "success",
		ReportID:   reportID,
		Collection: collection,
		Message:    message,
	})
}

// SendError writes a JSON error response with the given HTTP status code.
func SendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Status:  "error",
		Message: message,
	})
}

// SendAppError converts an AppError to an HTTP response.
func SendAppError(w http.ResponseWriter, err *apperrors.AppError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.StatusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "error",
		"code":    err.Code,
		"message": err.Message,
	})
}

// SendValidationError writes a 422 Unprocessable Entity with field-level errors.
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

// SendJSON writes any value as a JSON response with the given HTTP status.
func SendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, "json encoding error", http.StatusInternalServerError)
	}
}

// SendNoContent writes a 204 No Content response.
func SendNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// ExtractRequestID retrieves the request ID from the X-Request-Id header.
func ExtractRequestID(r *http.Request) string {
	return r.Header.Get("X-Request-Id")
}

// GetClientIP attempts to determine the real client IP address, checking
// X-Forwarded-For, X-Real-IP, and finally RemoteAddr in that order.
func GetClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// X-Forwarded-For may contain multiple IPs separated by commas
		parts := strings.Split(forwarded, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}
	// Strip port from RemoteAddr
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		addr = addr[:idx]
	}
	return addr
}
