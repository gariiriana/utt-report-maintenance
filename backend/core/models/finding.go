package models

import "time"

// FindingPhoto represents a single photo with description attached to a finding.
type FindingPhoto struct {
	Base64      string `json:"base64" firestore:"base64"`
	Description string `json:"description" firestore:"description"`
}

// Finding represents a maintenance finding / trouble report.
type Finding struct {
	ID             string         `json:"id" firestore:"id"`
	PartName       string         `json:"part_name" firestore:"part_name"`
	PartNumber     string         `json:"part_number" firestore:"part_number"`
	BrandName      string         `json:"brand_name" firestore:"brand_name"`
	Quantity       int            `json:"quantity" firestore:"quantity"`
	FindingDate    string         `json:"finding_date" firestore:"finding_date"`
	Photos         []FindingPhoto `json:"photos" firestore:"photos"`
	Remark         string         `json:"remark,omitempty" firestore:"remark,omitempty"`
	CreatedBy      string         `json:"created_by" firestore:"created_by"`
	CreatedByEmail string         `json:"created_by_email" firestore:"created_by_email"`
	CreatedAt      time.Time      `json:"created_at" firestore:"created_at"`
}
