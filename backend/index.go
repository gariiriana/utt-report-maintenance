package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
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
	var reportData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&reportData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Save to 'hse' collection
	docRef, _, err := client.Collection("hse").Add(ctx, reportData)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error saving report: %v", err), http.StatusInternalServerError)
		return
	}

	// Success Response
	response := map[string]string{
		"status":   "success",
		"reportId": docRef.ID,
		"message":  "HSE Report saved successfully via Golang!",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
