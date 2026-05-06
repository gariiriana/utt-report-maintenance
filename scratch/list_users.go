package main

import (
	"context"
	"fmt"
	"log"
	"os"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

func main() {
	ctx := context.Background()
	
	credPath := "firebase/firebase-service-account.json"
	if _, err := os.Stat(credPath); os.IsNotExist(err) {
		credPath = "../firebase/firebase-service-account.json"
	}

	opt := option.WithCredentialsFile(credPath)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		log.Fatalf("error initializing app: %v\n", err)
	}

	client, err := app.Auth(ctx)
	if err != nil {
		log.Fatalf("error getting Auth client: %v\n", err)
	}

	iter := client.Users(ctx, "")
	fmt.Println("List of Firebase Auth Users:")
	fmt.Println("---------------------------")
	for {
		user, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatalf("error listing users: %v\n", err)
		}
		fmt.Printf("Email: %-30s | UID: %s\n", user.Email, user.UID)
	}
}
