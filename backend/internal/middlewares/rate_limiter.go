package middlewares

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

type bucket struct {
	mu         sync.Mutex
	tokens     float64
	lastRefill time.Time
}

type RateLimiter struct {
	rps    float64
	burst  float64
	mu     sync.RWMutex
	ipMap  map[string]*bucket
}

func NewRateLimiter(rps, burst int) *RateLimiter {
	rl := &RateLimiter{
		rps:   float64(rps),
		burst: float64(burst),
		ipMap: make(map[string]*bucket),
	}
	go rl.cleanup()
	return rl
}

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
