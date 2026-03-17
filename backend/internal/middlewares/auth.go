package middlewares

import (
	"os"
)

func VerifySecret(clientSecret string) bool {
	serverSecret := os.Getenv("BACKEND_API_SECRET")
	if serverSecret == "" {
		return true 
	}
	return clientSecret == serverSecret
}
