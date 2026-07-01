package config

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var (
	firestoreOnce   sync.Once
	firestoreClient *firestore.Client
	authOnce        sync.Once
	authClient      *firebaseAuth.Client
	firebaseApp     *firebase.App
	firebaseErr     error
)
func getCredentialsJSON() ([]byte, error) {
	if creds := os.Getenv("FIREBASE_SERVICE_ACCOUNT"); creds != "" {

		creds = strings.TrimSpace(creds)
		creds = strings.Trim(creds, "\"")
		creds = strings.TrimSpace(creds)
		return []byte(creds), nil
	}

	paths := []string{
		"firebase-service-account.json",
		"../firebase-service-account.json",
		"backend/firebase-service-account.json",
		"api/firebase-service-account.json",
		"/var/task/firebase-service-account.json",
	}
	for _, p := range paths {
		if data, err := os.ReadFile(p); err == nil {
			return data, nil
		}
	}
	return nil, fmt.Errorf("firebase credentials not found in env or common paths")
}
func initFirebaseApp(ctx context.Context) (*firebase.App, error) {
	credJSON, err := getCredentialsJSON()
	if err != nil {
		return nil, err
	}
	opt := option.WithCredentialsJSON(credJSON)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("error initializing firebase app: %w", err)
	}
	return app, nil
}
func InitFirestore(ctx context.Context) (*firestore.Client, error) {
	firestoreOnce.Do(func() {
		var app *firebase.App
		app, firebaseErr = initFirebaseApp(ctx)
		if firebaseErr != nil {
			return
		}
		firebaseApp = app
		firestoreClient, firebaseErr = app.Firestore(ctx)
	})
	return firestoreClient, firebaseErr
}
func InitAuthClient(ctx context.Context) (*firebaseAuth.Client, error) {
	authOnce.Do(func() {
		if firebaseApp == nil {
			var err error
			firebaseApp, err = initFirebaseApp(ctx)
			if err != nil {
				firebaseErr = err
				return
			}
		}
		var err error
		authClient, err = firebaseApp.Auth(ctx)
		if err != nil {
			firebaseErr = fmt.Errorf("error initializing firebase auth: %w", err)
		}
	})
	return authClient, firebaseErr
}
func MustInitFirestore(ctx context.Context) *firestore.Client {
	client, err := InitFirestore(ctx)
	if err != nil {
		panic("FATAL: " + err.Error())
	}
	return client
}
