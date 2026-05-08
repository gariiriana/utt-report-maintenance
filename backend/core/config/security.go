package config

import "strings"
type SecurityPolicy struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int
	RateLimitRPS   int
	RateLimitBurst int
	BackendAPISecret string
	CSP string
	HSTSMaxAge int
	TrustedProxies []string
}
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
		HSTSMaxAge:     31536000,
		// SECURITY: Empty list — Vercel handles proxy trust internally.
		// Do NOT trust all IPs (0.0.0.0/0 was insecure).
		TrustedProxies: []string{},
	}
}
func (p *SecurityPolicy) IsOriginAllowed(origin string) bool {
	for _, o := range p.AllowedOrigins {
		if o == "*" || strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}
