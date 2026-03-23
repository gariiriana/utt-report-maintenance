package config

import (
	"sync"
	"time"
)
type CacheEntry struct {
	Value     interface{}
	ExpiresAt time.Time
}
func (e *CacheEntry) IsExpired() bool {
	return time.Now().UTC().After(e.ExpiresAt)
}
type MemoryCache struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry
	ttl     time.Duration
}
func NewMemoryCache(defaultTTL time.Duration) *MemoryCache {
	c := &MemoryCache{
		entries: make(map[string]*CacheEntry),
		ttl:     defaultTTL,
	}
	go c.evictLoop()
	return c
}
func (c *MemoryCache) Set(key string, value interface{}) {
	c.SetWithTTL(key, value, c.ttl)
}
func (c *MemoryCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = &CacheEntry{
		Value:     value,
		ExpiresAt: time.Now().UTC().Add(ttl),
	}
}
func (c *MemoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()

	if !ok || entry.IsExpired() {
		return nil, false
	}
	return entry.Value, true
}
func (c *MemoryCache) Delete(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}
func (c *MemoryCache) Flush() {
	c.mu.Lock()
	c.entries = make(map[string]*CacheEntry)
	c.mu.Unlock()
}
func (c *MemoryCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}
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
