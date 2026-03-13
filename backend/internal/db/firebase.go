package db

import (
	"context"
	"fmt"
	"os"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

func InitFirestore(ctx context.Context) (*firestore.Client, error) {
	creds := os.Getenv("FIREBASE_SERVICE_ACCOUNT")
	if creds == "" {
		data, err := os.ReadFile("firebase-service-account.json")
		if err == nil {
			creds = string(data)
		}
	}

	if creds == "" {
		return nil, fmt.Errorf("firebase credentials not found")
	}

	opt := option.WithCredentialsJSON([]byte(creds))
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("error initializing app: %w", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		return nil, fmt.Errorf("error initializing firestore: %w", err)
	}

	return client, nil
}
