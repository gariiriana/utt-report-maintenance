package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gariiriana/utt-report-maintenance/api/internal/auth"
	"github.com/gariiriana/utt-report-maintenance/api/internal/db"
	"github.com/gariiriana/utt-report-maintenance/api/internal/models"
)

func ReportHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Verify Authentication
	clientSecret := r.Header.Get("X-API-Secret")
	if !auth.VerifySecret(clientSecret) {
		sendError(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
		return
	}

	// 2. Initialise Database
	ctx := context.Background()
	client, err := db.InitFirestore(ctx)
	if err != nil {
		sendError(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// 3. Parse Request
	var requestBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// 4. Determine Collection
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
		sendError(w, fmt.Sprintf("Unauthorized collection: %s", collectionName), http.StatusForbidden)
		return
	}

	// 5. Process Data
	reportData := make(map[string]interface{})
	for k, v := range requestBody {
		if k != "collection" && k != "sub_data" {
			reportData[k] = v
		}
	}

	docRef, _, err := client.Collection(collectionName).Add(ctx, reportData)
	if err != nil {
		sendError(w, fmt.Sprintf("Error saving data: %v", err), http.StatusInternalServerError)
		return
	}

	// 6. Handle Sub-data (Photos)
	if subData, ok := requestBody["sub_data"].([]interface{}); ok {
		var wg sync.WaitGroup
		for i, item := range subData {
			if itemMap, ok := item.(map[string]interface{}); ok {
				wg.Add(1)
				go func(idx int, data map[string]interface{}) {
					defer wg.Done()
					_, _, err := docRef.Collection("photos").Add(ctx, data)
					if err != nil {
						fmt.Printf("Warning: Failed to save photo %d: %v\n", idx, err)
					}
				}(i, itemMap)
			}
		}
		wg.Wait()
	}

	// 7. Success Response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.SuccessResponse{
		Status:     "success",
		ReportID:   docRef.ID,
		Collection: collectionName,
		Message:    fmt.Sprintf("Data saved to %s via Modular Golang Backend!", collectionName),
	})
}

func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Status:  "error",
		Message: message,
	})
}
