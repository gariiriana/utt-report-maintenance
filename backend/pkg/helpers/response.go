package helpers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gariiriana/DwimitraSystem/backend/core/models"
	apperrors "github.com/gariiriana/DwimitraSystem/backend/pkg/errors"
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
// GetClientIP extracts the client IP from the request.
// SECURITY: Validates X-Forwarded-For entries; falls back to RemoteAddr
// if the forwarded IP looks suspicious (private/loopback ranges should not appear from public proxies).
func GetClientIP(r *http.Request) string {
	// Prefer X-Forwarded-For from trusted proxy (Vercel sets this)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		// Take the leftmost non-empty entry (client IP as set by the first proxy)
		for _, part := range parts {
			ip := strings.TrimSpace(part)
			if ip != "" && ip != "unknown" {
				return ip
			}
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
