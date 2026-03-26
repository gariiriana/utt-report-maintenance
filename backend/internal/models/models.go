package models

import "time"
type SuccessResponse struct {
	Status     string `json:"status"`
	ReportID   string `json:"reportId"`
	Collection string `json:"collection"`
	Message    string `json:"message"`
}
type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}
type ReportPayload struct {
	Collection string                   `json:"collection"`
	SubData    []map[string]interface{} `json:"sub_data,omitempty"`
}
type APIResponse struct {
	Status string      `json:"status"`
	Data   interface{} `json:"data"`
	Meta   interface{} `json:"meta,omitempty"`
}
type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}
func BuildAPIResponse(data interface{}, meta interface{}) APIResponse {
	return APIResponse{Status: "success", Data: data, Meta: meta}
}
