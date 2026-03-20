package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"sync"
	"time"
)

// contextKey is a private type for context keys to avoid collision.
type contextKey string

const requestIDKey contextKey = "request_id"

var (
	globalLogger *slog.Logger
	once         sync.Once
)

// Level constants mirror slog levels for convenience.
const (
	LevelDebug = slog.LevelDebug
	LevelInfo  = slog.LevelInfo
	LevelWarn  = slog.LevelWarn
	LevelError = slog.LevelError
)

// Config holds configuration for the logger.
type Config struct {
	Level     slog.Level
	AddSource bool
	JSON      bool
	Output    io.Writer
}

// DefaultConfig returns sensible production defaults.
func DefaultConfig() Config {
	lvl := slog.LevelInfo
	if os.Getenv("APP_ENV") == "development" {
		lvl = slog.LevelDebug
	}
	return Config{
		Level:     lvl,
		AddSource: false,
		JSON:      true,
		Output:    os.Stdout,
	}
}

// Init initialises the global logger. Safe to call multiple times; only first call takes effect.
func Init(cfg Config) {
	once.Do(func() {
		opts := &slog.HandlerOptions{
			Level:     cfg.Level,
			AddSource: cfg.AddSource,
		}

		var handler slog.Handler
		if cfg.JSON {
			handler = slog.NewJSONHandler(cfg.Output, opts)
		} else {
			handler = slog.NewTextHandler(cfg.Output, opts)
		}

		globalLogger = slog.New(handler)
		slog.SetDefault(globalLogger)
	})
}

// L returns the global logger, initialising with defaults if needed.
func L() *slog.Logger {
	if globalLogger == nil {
		Init(DefaultConfig())
	}
	return globalLogger
}

// WithRequestID returns a logger enriched with the given request ID.
func WithRequestID(requestID string) *slog.Logger {
	return L().With(slog.String("request_id", requestID))
}

// FromContext extracts a request ID from context and returns an enriched logger.
func FromContext(ctx context.Context) *slog.Logger {
	if rid, ok := ctx.Value(requestIDKey).(string); ok && rid != "" {
		return WithRequestID(rid)
	}
	return L()
}

// WithContext stores a request ID in the context for later retrieval.
func WithContext(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

// --- Convenience wrappers ---

func Debug(msg string, args ...any) { L().Debug(msg, args...) }
func Info(msg string, args ...any)  { L().Info(msg, args...) }
func Warn(msg string, args ...any)  { L().Warn(msg, args...) }
func Error(msg string, args ...any) { L().Error(msg, args...) }

// LogHTTPRequest logs a structured HTTP request record.
func LogHTTPRequest(method, path, requestID, remoteAddr string, status int, duration time.Duration) {
	L().Info("http_request",
		slog.String("method", method),
		slog.String("path", path),
		slog.String("request_id", requestID),
		slog.String("remote_addr", remoteAddr),
		slog.Int("status", status),
		slog.Duration("duration", duration),
	)
}

// LogSecurityEvent logs a security-relevant event at WARN level.
func LogSecurityEvent(event, requestID, remoteAddr, detail string) {
	L().Warn("security_event",
		slog.String("event", event),
		slog.String("request_id", requestID),
		slog.String("remote_addr", remoteAddr),
		slog.String("detail", detail),
	)
}

// LogAuditEvent logs an audit trail entry at INFO level.
func LogAuditEvent(action, userUID, collection, docID string) {
	L().Info("audit_event",
		slog.String("action", action),
		slog.String("user_uid", userUID),
		slog.String("collection", collection),
		slog.String("doc_id", docID),
		slog.Time("timestamp", time.Now().UTC()),
	)
}
