package config

import (
	"sync"
	"time"
)

// CacheEntry holds a cached value with an expiry time.
type CacheEntry struct {
	Value     interface{}
	ExpiresAt time.Time
}

// IsExpired returns true if the cache entry has passed its expiry time.
func (e *CacheEntry) IsExpired() bool {
	return time.Now().UTC().After(e.ExpiresAt)
}

// MemoryCache is a simple, concurrency-safe in-memory key-value cache.
// It is intended for short-lived data such as rate-limit counters and
// token verification caches, NOT as a general-purpose database cache.
type MemoryCache struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry
	ttl     time.Duration
}

// NewMemoryCache creates a MemoryCache with the given default TTL.
func NewMemoryCache(defaultTTL time.Duration) *MemoryCache {
	c := &MemoryCache{
		entries: make(map[string]*CacheEntry),
		ttl:     defaultTTL,
	}
	go c.evictLoop()
	return c
}

// Set stores a value for the given key, using the default TTL.
func (c *MemoryCache) Set(key string, value interface{}) {
	c.SetWithTTL(key, value, c.ttl)
}

// SetWithTTL stores a value with a custom TTL.
func (c *MemoryCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = &CacheEntry{
		Value:     value,
		ExpiresAt: time.Now().UTC().Add(ttl),
	}
}

// Get retrieves a value by key. Returns (nil, false) if the key is missing or expired.
func (c *MemoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()

	if !ok || entry.IsExpired() {
		return nil, false
	}
	return entry.Value, true
}

// Delete removes a key from the cache.
func (c *MemoryCache) Delete(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}

// Flush removes all entries from the cache.
func (c *MemoryCache) Flush() {
	c.mu.Lock()
	c.entries = make(map[string]*CacheEntry)
	c.mu.Unlock()
}

// Len returns the number of entries currently in the cache (including expired).
func (c *MemoryCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// evictLoop periodically removes expired entries to prevent unbounded growth.
func (c *MemoryCache) evictLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		c.mu.Lock()
		for k, v := range c.entries {
			if v.IsExpired() {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}
