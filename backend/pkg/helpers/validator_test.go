package helpers

import (
	"testing"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
)

func TestValidateStruct(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		wantErr bool
	}{
		{
			name: "Valid Report Request",
			input: &models.CreateReportRequest{
				Collection:  "hse",
				Title:       "Test Report",
				Description: "Valid description",
				ReportType:  models.ReportTypeHSE,
				Tags:        []string{"test", "unit"},
				Photos: []models.Photo{
					{URL: "https://example.com/photo.jpg", Caption: "Test Photo"},
				},
			},
			wantErr: false,
		},
		{
			name: "Invalid Collection",
			input: &models.CreateReportRequest{
				Collection: "invalid_collection",
				Title:      "Test Report",
				ReportType: models.ReportTypeHSE,
			},
			wantErr: true,
		},
		{
			name: "Title Too Short",
			input: &models.CreateReportRequest{
				Collection: "hse",
				Title:      "Hi",
				ReportType: models.ReportTypeHSE,
			},
			wantErr: true,
		},
		{
			name: "Invalid Photo URL",
			input: &models.CreateReportRequest{
				Collection: "hse",
				Title:      "Test Report",
				ReportType: models.ReportTypeHSE,
				Photos: []models.Photo{
					{URL: "not-a-url"},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStruct(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateStruct() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
