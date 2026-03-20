package models

import "time"

// SuccessResponse is the standard API success envelope.
type SuccessResponse struct {
	Status     string `json:"status"`
	ReportID   string `json:"reportId"`
	Collection string `json:"collection"`
	Message    string `json:"message"`
}

// ErrorResponse is the standard API error envelope.
type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ReportPayload is the expected shape of the incoming save request.
type ReportPayload struct {
	Collection string                   `json:"collection"`
	SubData    []map[string]interface{} `json:"sub_data,omitempty"`
}

// APIResponse is a generic paginated/listed response wrapper.
type APIResponse struct {
	Status string      `json:"status"`
	Data   interface{} `json:"data"`
	Meta   interface{} `json:"meta,omitempty"`
}

// HealthStatus represents the liveness/readiness payload.
type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}

// BuildAPIResponse wraps data in the standard APIResponse.
func BuildAPIResponse(data interface{}, meta interface{}) APIResponse {
	return APIResponse{Status: "success", Data: data, Meta: meta}
}
