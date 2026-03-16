package middlewares

import (
	"os"
)

func VerifySecret(clientSecret string) bool {
	serverSecret := os.Getenv("BACKEND_API_SECRET")
	if serverSecret == "" {
		// If not set, we might be in dev mode or forgot to set it.
		// For safety, we could allow it or block it. Here we block if set,
		// but if serverSecret is empty, we might allow (or vice versa).
		// Standard security: if secret is defined on server, must match.
		return true 
	}
	return clientSecret == serverSecret
}
