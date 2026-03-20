package middlewares

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

const requestIDHeader = "X-Request-Id"

// requestIDCtxKey is a private context key for the request ID.
type requestIDCtxKey struct{}

// RequestID is an HTTP middleware that ensures every request has a unique
// request ID. It reads X-Request-Id from the incoming request headers
// (so upstream proxies can propagate IDs), generating a new UUID v4 if absent.
// The ID is injected into the request context and echoed in the response header.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get(requestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Inject into response header immediately so it's available on errors too
		w.Header().Set(requestIDHeader, requestID)

		// Store in context for downstream use
		ctx := context.WithValue(r.Context(), requestIDCtxKey{}, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID retrieves the request ID from the context.
// Returns an empty string if not set.
func GetRequestID(ctx context.Context) string {
	rid, _ := ctx.Value(requestIDCtxKey{}).(string)
	return rid
}
