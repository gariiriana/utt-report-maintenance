package models

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
	// Additional dynamic fields will be handled via map[string]interface{} in service
}

