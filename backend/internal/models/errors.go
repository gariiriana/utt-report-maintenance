package models

import "time"
type AppErrorModel struct {
	Status    string    `json:"status"`
	Code      string    `json:"code"`
	Message   string    `json:"message"`
	RequestID string    `json:"request_id,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
type ValidationErrorModel struct {
	Status    string            `json:"status"`
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	Fields    map[string]string `json:"fields"`
	Timestamp time.Time         `json:"timestamp"`
}
func NewAppErrorModel(code, message, requestID string) AppErrorModel {
	return AppErrorModel{
		Status:    "error",
		Code:      code,
		Message:   message,
		RequestID: requestID,
		Timestamp: time.Now().UTC(),
	}
}
func NewValidationErrorModel(fields map[string]string, requestID string) ValidationErrorModel {
	return ValidationErrorModel{
		Status:    "error",
		Code:      "VALIDATION_ERROR",
		Message:   "One or more fields failed validation",
		Fields:    fields,
		Timestamp: time.Now().UTC(),
	}
}
type RateLimitErrorModel struct {
	Status     string    `json:"status"`
	Code       string    `json:"code"`
	Message    string    `json:"message"`
	RetryAfter int       `json:"retry_after_seconds"`
	Timestamp  time.Time `json:"timestamp"`
}
func NewRateLimitError(retryAfterSeconds int) RateLimitErrorModel {
	return RateLimitErrorModel{
		Status:     "error",
		Code:       "RATE_LIMIT_EXCEEDED",
		Message:    "Too many requests. Please slow down.",
		RetryAfter: retryAfterSeconds,
		Timestamp:  time.Now().UTC(),
	}
}
