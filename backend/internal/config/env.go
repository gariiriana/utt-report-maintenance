package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// EnvString returns the value of the given environment variable as a string.
// If not set, returns the provided default.
func EnvString(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// EnvRequired returns the value of a required environment variable.
// It panics if the variable is empty, to catch misconfiguration early at startup.
func EnvRequired(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("FATAL: required environment variable %q is not set", key))
	}
	return v
}

// EnvInt parses an environment variable as an integer, falling back to defaultVal.
func EnvInt(key string, defaultVal int) int {
	s := os.Getenv(key)
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return n
}

// EnvBool parses an environment variable as a boolean ("true", "1", "yes").
// Falls back to defaultVal on missing or unrecognisable values.
func EnvBool(key string, defaultVal bool) bool {
	s := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch s {
	case "true", "1", "yes":
		return true
	case "false", "0", "no":
		return false
	}
	return defaultVal
}

// EnvDuration parses an environment variable as a time.Duration (e.g. "24h", "30m").
// Falls back to defaultVal on missing or malformed values.
func EnvDuration(key string, defaultVal time.Duration) time.Duration {
	s := os.Getenv(key)
	if s == "" {
		return defaultVal
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return defaultVal
	}
	return d
}

// EnvStringSlice parses a comma-separated environment variable into a string slice.
func EnvStringSlice(key string, defaultVals []string) []string {
	s := os.Getenv(key)
	if s == "" {
		return defaultVals
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// MustLoadDotEnv attempts to load a .env file if it exists (development only).
// Reads each non-comment KEY=VALUE line and calls os.Setenv if the key is not already set.
func MustLoadDotEnv(filepath string) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return // .env is optional; not a fatal error
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Do not overwrite existing environment variables
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}
