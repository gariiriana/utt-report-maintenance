package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

type TurnstileResponse struct {
	Success     bool     `json:"success"`
	ErrorCodes  []string `json:"error-codes"`
	ChallengeTS string   `json:"challenge_ts"`
	Hostname    string   `json:"hostname"`
}

type TurnstileService struct {
	httpClient *http.Client
}

func NewTurnstileService() *TurnstileService {
	return &TurnstileService{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Verify checks a Turnstile response token with Cloudflare siteverify API.
func (s *TurnstileService) Verify(ctx context.Context, responseToken string, remoteIP string) (bool, error) {
	secretKey := os.Getenv("TURNSTILE_SECRET")
	if secretKey == "" {
		secretKey = os.Getenv("TURNSTILE_SECRET_KEY")
	}
	if secretKey == "" {
		// Fallback to testing secret key for development environment
		secretKey = "1x0000000000000000000000000000000AA"
	}

	formData := url.Values{
		"secret":   {secretKey},
		"response": {responseToken},
	}
	if remoteIP != "" {
		formData.Set("remoteip", remoteIP)
	}

	resp, err := s.httpClient.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", formData)
	if err != nil {
		return false, fmt.Errorf("TurnstileService.Verify HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	var turnstileResp TurnstileResponse
	if err := json.NewDecoder(resp.Body).Decode(&turnstileResp); err != nil {
		return false, fmt.Errorf("TurnstileService.Verify failed to decode JSON: %w", err)
	}

	return turnstileResp.Success, nil
}
