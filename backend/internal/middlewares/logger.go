package middlewares

import (
	"net/http"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode    int
	bytesWritten  int64
	headerWritten bool
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.headerWritten {
		rw.statusCode = code
		rw.headerWritten = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

// Logger is an HTTP middleware that logs each incoming request with method, path,
// status, duration, request ID, and remote IP using the structured logger.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := newResponseWriter(w)
		requestID := GetRequestID(r.Context())

		defer func() {
			duration := time.Since(start)
			logger.LogHTTPRequest(
				r.Method,
				r.URL.Path,
				requestID,
				helpers.GetClientIP(r),
				rw.statusCode,
				duration,
			)
		}()

		next.ServeHTTP(rw, r)
	})
}

// RecoverPanic is an HTTP middleware that recovers from panics, logs the event,
// and returns a 500 Internal Server Error to the client.
func RecoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				requestID := GetRequestID(r.Context())
				logger.LogSecurityEvent("panic_recovered", requestID, helpers.GetClientIP(r), "handler panicked")
				helpers.SendError(w, "Internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// MaxBodySize limits the size of incoming request bodies to prevent abuse.
// maxBytes is specified in bytes (e.g., 10 << 20 = 10 MiB).
func MaxBodySize(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

// MethodCheck restricts allowed HTTP methods. Returns 405 for disallowed methods.
func MethodCheck(allowedMethods ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedMethods))
	for _, m := range allowedMethods {
		allowed[m] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			if !allowed[r.Method] {
				helpers.SendError(w, "Method Not Allowed", http.StatusMethodNotAllowed)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
