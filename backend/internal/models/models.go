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
