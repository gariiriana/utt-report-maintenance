package config

import "strings"

// SecurityPolicy holds all security-related configuration.
type SecurityPolicy struct {
	// CORS
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int // preflight cache in seconds

	// Rate limiting
	RateLimitRPS   int
	RateLimitBurst int

	// API secret
	BackendAPISecret string

	// Content Security Policy header value
	CSP string

	// HSTS max-age in seconds (0 = disabled)
	HSTSMaxAge int

	// Trusted proxy CIDR ranges (for IP extraction)
	TrustedProxies []string
}

// DefaultSecurityPolicy returns a secure default policy.
// Origins and secret should be overridden from environment variables.
func DefaultSecurityPolicy(cfg *AppConfig) SecurityPolicy {
	allowedOrigins := cfg.AllowedOrigins
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:3000"}
	}

	return SecurityPolicy{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Authorization",
			"X-API-Secret",
			"X-Request-Id",
			"X-Requested-With",
		},
		ExposedHeaders:   []string{"X-Request-Id", "X-Backend-Handler"},
		AllowCredentials: true,
		MaxAge:           86400,
		RateLimitRPS:     cfg.RateLimitRPS,
		RateLimitBurst:   cfg.RateLimitBurst,
		BackendAPISecret: cfg.BackendAPISecret,
		CSP: strings.Join([]string{
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https:",
			"connect-src 'self' https://*.googleapis.com https://*.firebase.googleapis.com",
			"frame-ancestors 'none'",
		}, "; "),
		HSTSMaxAge:     31536000, // 1 year
		TrustedProxies: []string{"0.0.0.0/0"},
	}
}

// IsOriginAllowed returns true if the given origin is in the AllowedOrigins list.
// A wildcard "*" in the list permits all origins.
func (p *SecurityPolicy) IsOriginAllowed(origin string) bool {
	for _, o := range p.AllowedOrigins {
		if o == "*" || strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}
