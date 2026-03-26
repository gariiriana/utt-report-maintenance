package repositories

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
)
type CacheEntry struct {
	Snapshot  *firestore.DocumentSnapshot
	ExpiresAt time.Time
}
func (e *CacheEntry) IsExpired() bool {
	return time.Now().UTC().After(e.ExpiresAt)
}
type CacheRepository struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry
	ttl     time.Duration
}
func NewCacheRepository(ttl time.Duration) *CacheRepository {
	cr := &CacheRepository{
		entries: make(map[string]*CacheEntry),
		ttl:     ttl,
	}
	go cr.evict()
	return cr
}
func (r *CacheRepository) CollectionName() string { return "_cache" }
func cacheKey(collection, docID string) string {
	return fmt.Sprintf("%s::%s", collection, docID)
}
func (r *CacheRepository) Get(collection, docID string) (*firestore.DocumentSnapshot, bool) {
	r.mu.RLock()
	entry, ok := r.entries[cacheKey(collection, docID)]
	r.mu.RUnlock()
	if !ok || entry.IsExpired() {
		return nil, false
	}
	return entry.Snapshot, true
}
func (r *CacheRepository) Set(collection, docID string, snap *firestore.DocumentSnapshot) {
	r.mu.Lock()
	r.entries[cacheKey(collection, docID)] = &CacheEntry{
		Snapshot:  snap,
		ExpiresAt: time.Now().UTC().Add(r.ttl),
	}
	r.mu.Unlock()
}
func (r *CacheRepository) Invalidate(collection, docID string) {
	r.mu.Lock()
	delete(r.entries, cacheKey(collection, docID))
	r.mu.Unlock()
}
func (r *CacheRepository) InvalidateCollection(collection string) {
	prefix := collection + "::"
	r.mu.Lock()
	for k := range r.entries {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(r.entries, k)
		}
	}
	r.mu.Unlock()
}
func (r *CacheRepository) GetOrFetch(ctx context.Context, client *firestore.Client, collection, docID string) (*firestore.DocumentSnapshot, error) {
	if snap, ok := r.Get(collection, docID); ok {
		return snap, nil
	}
	snap, err := client.Collection(collection).Doc(docID).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("CacheRepository.GetOrFetch(%s/%s): %w", collection, docID, err)
	}
	r.Set(collection, docID, snap)
	return snap, nil
}
func (r *CacheRepository) evict() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		r.mu.Lock()
		for k, v := range r.entries {
			if v.IsExpired() {
				delete(r.entries, k)
			}
		}
		r.mu.Unlock()
	}
}
