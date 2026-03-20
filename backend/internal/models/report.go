package models

import "time"

// ReportType identifies the kind of report stored.
type ReportType string

const (
	ReportTypeHSE     ReportType = "hse"
	ReportTypePDF     ReportType = "pdf_documents"
	ReportTypeExcel   ReportType = "excel_documents"
	ReportTypeService ReportType = "service_reports"
)

// AllowedCollections contains the set of Firestore collection names that
// the backend is authorised to write to.
var AllowedCollections = map[string]bool{
	string(ReportTypeHSE):     true,
	string(ReportTypePDF):     true,
	string(ReportTypeExcel):   true,
	string(ReportTypeService): true,
}

// Report represents a persisted report document in Firestore.
type Report struct {
	ID             string                   `json:"id" firestore:"id"`
	Collection     string                   `json:"collection" firestore:"collection"`
	Title          string                   `json:"title" firestore:"title"`
	Description    string                   `json:"description,omitempty" firestore:"description,omitempty"`
	ReportType     ReportType               `json:"report_type" firestore:"report_type"`
	AuthorUID      string                   `json:"author_uid,omitempty" firestore:"author_uid,omitempty"`
	AuthorEmail    string                   `json:"author_email,omitempty" firestore:"author_email,omitempty"`
	Status         string                   `json:"status" firestore:"status"`
	Tags           []string                 `json:"tags,omitempty" firestore:"tags,omitempty"`
	Metadata       map[string]interface{}   `json:"metadata,omitempty" firestore:"metadata,omitempty"`
	Photos         []map[string]interface{} `json:"photos,omitempty" firestore:"-"`
	CreatedAt      time.Time                `json:"created_at" firestore:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at" firestore:"updated_at"`
}

// ReportListItem is a lightweight summary used in list endpoints.
type ReportListItem struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	ReportType  ReportType `json:"report_type"`
	AuthorEmail string     `json:"author_email,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ToListItem converts a full Report to a lightweight summary.
func (r *Report) ToListItem() ReportListItem {
	return ReportListItem{
		ID:          r.ID,
		Title:       r.Title,
		ReportType:  r.ReportType,
		AuthorEmail: r.AuthorEmail,
		Status:      r.Status,
		CreatedAt:   r.CreatedAt,
	}
}

// ReportFilter holds the available query filters for listing reports.
type ReportFilter struct {
	ReportType ReportType `json:"report_type,omitempty"`
	AuthorUID  string     `json:"author_uid,omitempty"`
	Status     string     `json:"status,omitempty"`
	DateFrom   time.Time  `json:"date_from,omitempty"`
	DateTo     time.Time  `json:"date_to,omitempty"`
}
