package middlewares

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

// bucket holds the token bucket state for a single IP address.
type bucket struct {
	mu         sync.Mutex
	tokens     float64
	lastRefill time.Time
}

// RateLimiter implements a per-IP token bucket rate limiter.
type RateLimiter struct {
	rps    float64 // tokens added per second
	burst  float64 // maximum tokens
	mu     sync.RWMutex
	ipMap  map[string]*bucket
}

// NewRateLimiter creates a RateLimiter with the given requests-per-second and burst capacity.
func NewRateLimiter(rps, burst int) *RateLimiter {
	rl := &RateLimiter{
		rps:   float64(rps),
		burst: float64(burst),
		ipMap: make(map[string]*bucket),
	}
	// Periodically clean up stale IP entries
	go rl.cleanup()
	return rl
}

// Allow returns true if a request from the given IP should be allowed.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.RLock()
	b, ok := rl.ipMap[ip]
	rl.mu.RUnlock()

	if !ok {
		b = &bucket{tokens: rl.burst, lastRefill: time.Now()}
		rl.mu.Lock()
		rl.ipMap[ip] = b
		rl.mu.Unlock()
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * rl.rps
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.lastRefill = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// Middleware returns an http.Handler middleware that enforces the rate limit.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := helpers.GetClientIP(r)
		if !rl.Allow(ip) {
			requestID := r.Header.Get("X-Request-Id")
			logger.LogSecurityEvent("rate_limit_exceeded", requestID, ip, fmt.Sprintf("limit=%.0f/s burst=%.0f", rl.rps, rl.burst))
			w.Header().Set("Retry-After", "5")
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%.0f", rl.rps))
			helpers.SendError(w, "Too many requests. Please slow down.", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// cleanup removes IP buckets that have been inactive for more than 10 minutes.
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		threshold := time.Now().Add(-10 * time.Minute)
		rl.mu.Lock()
		for ip, b := range rl.ipMap {
			b.mu.Lock()
			if b.lastRefill.Before(threshold) {
				delete(rl.ipMap, ip)
			}
			b.mu.Unlock()
		}
		rl.mu.Unlock()
	}
}
