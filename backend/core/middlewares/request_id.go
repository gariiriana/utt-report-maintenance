package middlewares

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

const requestIDHeader = "X-Request-Id"
type requestIDCtxKey struct{}
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get(requestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}
		w.Header().Set(requestIDHeader, requestID)
		ctx := context.WithValue(r.Context(), requestIDCtxKey{}, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func GetRequestID(ctx context.Context) string {
	rid, _ := ctx.Value(requestIDCtxKey{}).(string)
	return rid
}
