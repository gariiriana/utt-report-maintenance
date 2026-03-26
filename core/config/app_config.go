package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)
type AppConfig struct {
	Port        string
	Env         string
	AppName     string
	AppVersion  string
	BackendAPISecret  string
	AllowedOrigins    []string
	MaxRequestBodyMB  int64
	RateLimitRPS      int
	RateLimitBurst    int
	TokenExpiry       time.Duration
	FirebaseProjectID       string
	FirebaseServiceAccount  string
	LogLevel  string
	LogFormat string // "json" | "text"
}
func Load() (*AppConfig, error) {
	cfg := &AppConfig{
		Port:             getEnvOrDefault("PORT", "8080"),
		Env:              getEnvOrDefault("APP_ENV", "production"),
		AppName:          getEnvOrDefault("APP_NAME", "utt-report-maintenance"),
		AppVersion:       getEnvOrDefault("APP_VERSION", "1.0.0"),
		BackendAPISecret: os.Getenv("BACKEND_API_SECRET"),
		AllowedOrigins:   parseCSV(getEnvOrDefault("ALLOWED_ORIGINS", "http://localhost:3000")),
		MaxRequestBodyMB: 10,
		RateLimitRPS:    20,
		RateLimitBurst:  40,
		TokenExpiry:     24 * time.Hour,
		FirebaseProjectID:      os.Getenv("FIREBASE_PROJECT_ID"),
		FirebaseServiceAccount: os.Getenv("FIREBASE_SERVICE_ACCOUNT"),
		LogLevel:  getEnvOrDefault("LOG_LEVEL", "info"),
		LogFormat: getEnvOrDefault("LOG_FORMAT", "json"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}
func (c *AppConfig) validate() error {
	if c.FirebaseProjectID == "" && c.FirebaseServiceAccount == "" {
	}
	if c.Env != "development" && c.Env != "staging" && c.Env != "production" {
		return fmt.Errorf("invalid APP_ENV value: %s (expected development|staging|production)", c.Env)
	}
	return nil
}
func (c *AppConfig) IsDevelopment() bool { return c.Env == "development" }
func (c *AppConfig) IsProduction() bool { return c.Env == "production" }
func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
func parseCSV(csv string) []string {
	parts := strings.Split(csv, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
