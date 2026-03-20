package config

import (
	"context"
	"fmt"
	"os"
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

// getCredentialsJSON returns the Firebase service account credentials JSON,
// preferring the environment variable over a local file.
func getCredentialsJSON() ([]byte, error) {
	if creds := os.Getenv("FIREBASE_SERVICE_ACCOUNT"); creds != "" {
		return []byte(creds), nil
	}
	data, err := os.ReadFile("firebase-service-account.json")
	if err != nil {
		return nil, fmt.Errorf("firebase credentials not found in env or file: %w", err)
	}
	return data, nil
}

// initFirebaseApp creates the Firebase app singleton.
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

// InitFirestore initialises and returns the Firestore client singleton.
// Subsequent calls return the same client.
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

// InitAuthClient initialises and returns the Firebase Auth client singleton.
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

// MustInitFirestore panics if Firestore cannot be initialised.
// Intended for use during application startup only.
func MustInitFirestore(ctx context.Context) *firestore.Client {
	client, err := InitFirestore(ctx)
	if err != nil {
		panic("FATAL: " + err.Error())
	}
	return client
}
