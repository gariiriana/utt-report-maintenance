package repositories

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
)

// CacheEntry holds a Firestore snapshot along with its expiry time.
type CacheEntry struct {
	Snapshot  *firestore.DocumentSnapshot
	ExpiresAt time.Time
}

// IsExpired returns true if the cache entry is past its expiry.
func (e *CacheEntry) IsExpired() bool {
	return time.Now().UTC().After(e.ExpiresAt)
}

// CacheRepository is a thin cache layer in front of Firestore reads.
// It holds snapshots in memory to reduce Firestore read costs on hot paths.
type CacheRepository struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry
	ttl     time.Duration
}

// NewCacheRepository constructs a CacheRepository with the given TTL duration.
func NewCacheRepository(ttl time.Duration) *CacheRepository {
	cr := &CacheRepository{
		entries: make(map[string]*CacheEntry),
		ttl:     ttl,
	}
	go cr.evict()
	return cr
}

// CollectionName returns an identifier (cache is not tied to one collection).
func (r *CacheRepository) CollectionName() string { return "_cache" }

// cacheKey builds a composite cache key from collection and document ID.
func cacheKey(collection, docID string) string {
	return fmt.Sprintf("%s::%s", collection, docID)
}

// Get looks up a cached Firestore snapshot. Returns (nil, false) on miss or expiry.
func (r *CacheRepository) Get(collection, docID string) (*firestore.DocumentSnapshot, bool) {
	r.mu.RLock()
	entry, ok := r.entries[cacheKey(collection, docID)]
	r.mu.RUnlock()
	if !ok || entry.IsExpired() {
		return nil, false
	}
	return entry.Snapshot, true
}

// Set stores a Firestore snapshot in the cache for the configured TTL.
func (r *CacheRepository) Set(collection, docID string, snap *firestore.DocumentSnapshot) {
	r.mu.Lock()
	r.entries[cacheKey(collection, docID)] = &CacheEntry{
		Snapshot:  snap,
		ExpiresAt: time.Now().UTC().Add(r.ttl),
	}
	r.mu.Unlock()
}

// Invalidate removes a specific entry from the cache.
func (r *CacheRepository) Invalidate(collection, docID string) {
	r.mu.Lock()
	delete(r.entries, cacheKey(collection, docID))
	r.mu.Unlock()
}

// InvalidateCollection removes all cached entries for a given collection.
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

// GetOrFetch returns a cached snapshot, or fetches it from Firestore and caches it.
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

// evict runs periodically to remove expired entries and prevent memory growth.
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
