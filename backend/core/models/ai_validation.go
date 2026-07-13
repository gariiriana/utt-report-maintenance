package models

// FormValidationRequest represents the input for AI ATS form validation.
type FormValidationRequest struct {
	ReportData ATSReportData    `json:"report_data"`
	Photos     []ATSPhotoInput  `json:"photos"`
}

// FormValidationIssue represents a single validation issue or warning found by the AI.
type FormValidationIssue struct {
	Field    string `json:"field"`    // e.g. "grounding_resistance.result_ohm"
	Severity string `json:"severity"` // "warning" or "error"
	Message  string `json:"message"`  // explanation in Indonesian
}

// FormValidationResponse is the output returned by the AI validator.
type FormValidationResponse struct {
	IsValid         bool                  `json:"is_valid"`
	Summary         string                `json:"summary"`
	Issues          []FormValidationIssue `json:"issues"`
	Recommendations []string              `json:"recommendations"`
}
