package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	// Tighten CORS
	origin := r.Header.Get("Origin")
	allowedOrigins := map[string]bool{
		"https://report-utt.web.app": true,
		"https://report-utt.firebaseapp.com": true,
		"http://localhost:5173": true, // Vite Local
		"http://localhost:3000": true, // Vercel Local
	}

	if allowedOrigins[origin] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Secret")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	// Verify API Secret
	clientSecret := r.Header.Get("X-API-Secret")
	serverSecret := os.Getenv("BACKEND_API_SECRET")
	if serverSecret != "" && clientSecret != serverSecret {
		http.Error(w, "Unauthorized: Invalid API Secret", http.StatusUnauthorized)
		return
	}

	// Initialize Firebase
	ctx := context.Background()
	
	// Get credentials
	creds := os.Getenv("FIREBASE_SERVICE_ACCOUNT")
	// Fallback for local testing if env not set
	if creds == "" {
		data, err := os.ReadFile("../firebase-service-account.json")
		if err == nil {
			creds = string(data)
		}
	}

	if creds == "" {
		http.Error(w, "Firebase credentials not found", http.StatusInternalServerError)
		return
	}

	opt := option.WithCredentialsJSON([]byte(creds))
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error initializing app: %v", err), http.StatusInternalServerError)
		return
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error initializing firestore: %v", err), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Parse Request Body
	var requestBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Determine collection (default to 'hse' for backward compatibility)
	collectionName, ok := requestBody["collection"].(string)
	if !ok || collectionName == "" {
		collectionName = "hse"
	}

	// Security: Whitelist allowed collections
	allowedCollections := map[string]bool{
		"hse":              true,
		"pdf_documents":    true,
		"excel_documents":  true,
		"service_reports":  true,
		"users":           false, // Block sensitive collections
	}

	if !allowedCollections[collectionName] {
		http.Error(w, fmt.Sprintf("Unauthorized collection: %s", collectionName), http.StatusForbidden)
		return
	}

	// Extract actual data (everything except 'collection' and 'sub_collection' info)
	reportData := make(map[string]interface{})
	for k, v := range requestBody {
		if k != "collection" && k != "sub_data" {
			reportData[k] = v
		}
	}

	// Save to specified collection
	docRef, _, err := client.Collection(collectionName).Add(ctx, reportData)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error saving to %s: %v", collectionName, err), http.StatusInternalServerError)
		return
	}

	// Handle sub-data if present (e.g., photos array)
	if subData, ok := requestBody["sub_data"].([]interface{}); ok {
		var wg sync.WaitGroup
		for i, item := range subData {
			if itemMap, ok := item.(map[string]interface{}); ok {
				wg.Add(1)
				go func(idx int, data map[string]interface{}) {
					defer wg.Done()
					_, _, err := docRef.Collection("photos").Add(ctx, data)
					if err != nil {
						fmt.Printf("Warning: Failed to save sub-item %d: %v\n", idx, err)
					}
				}(i, itemMap)
			}
		}
		wg.Wait()
	}

	// Success Response
	response := map[string]interface{}{
		"status":     "success",
		"reportId":   docRef.ID,
		"collection": collectionName,
		"message":    fmt.Sprintf("Data saved successfully to %s via Golang!", collectionName),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
