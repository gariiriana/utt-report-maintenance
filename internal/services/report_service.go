package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/gariiriana/utt-report-maintenance/internal/repositories"
)

type ReportService struct {
	Repo *repositories.ReportRepository
}

func NewReportService(repo *repositories.ReportRepository) *ReportService {
	return &ReportService{Repo: repo}
}

func (s *ReportService) ProcessReport(ctx context.Context, requestBody map[string]interface{}) (string, string, error) {
	// Determine Collection
	collectionName, ok := requestBody["collection"].(string)
	if !ok || collectionName == "" {
		collectionName = "hse"
	}

	// Security Whitelist
	allowedCollections := map[string]bool{
		"hse":             true,
		"pdf_documents":   true,
		"excel_documents": true,
		"service_reports": true,
	}

	if !allowedCollections[collectionName] {
		return "", "", fmt.Errorf("unauthorized collection: %s", collectionName)
	}

	// Process Data
	reportData := make(map[string]interface{})
	for k, v := range requestBody {
		if k != "collection" && k != "sub_data" {
			reportData[k] = v
		}
	}

	docRef, err := s.Repo.SaveReport(ctx, collectionName, reportData)
	if err != nil {
		return "", "", fmt.Errorf("error saving data: %w", err)
	}

	// Handle Sub-data (Photos) concurrently
	if subData, ok := requestBody["sub_data"].([]interface{}); ok {
		var wg sync.WaitGroup
		for i, item := range subData {
			if itemMap, ok := item.(map[string]interface{}); ok {
				wg.Add(1)
				go func(idx int, data map[string]interface{}) {
					defer wg.Done()
					err := s.Repo.SaveSubData(ctx, docRef, "photos", data)
					if err != nil {
						fmt.Printf("Warning: Failed to save photo %d: %v\n", idx, err)
					}
				}(i, itemMap)
			}
		}
		wg.Wait()
	}

	return docRef.ID, collectionName, nil
}
