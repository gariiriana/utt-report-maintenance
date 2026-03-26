package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"sync"
	"time"
)
type contextKey string

const requestIDKey contextKey = "request_id"

var (
	globalLogger *slog.Logger
	once         sync.Once
)
const (
	LevelDebug = slog.LevelDebug
	LevelInfo  = slog.LevelInfo
	LevelWarn  = slog.LevelWarn
	LevelError = slog.LevelError
)
type Config struct {
	Level     slog.Level
	AddSource bool
	JSON      bool
	Output    io.Writer
}
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
func L() *slog.Logger {
	if globalLogger == nil {
		Init(DefaultConfig())
	}
	return globalLogger
}
func WithRequestID(requestID string) *slog.Logger {
	return L().With(slog.String("request_id", requestID))
}
func FromContext(ctx context.Context) *slog.Logger {
	if rid, ok := ctx.Value(requestIDKey).(string); ok && rid != "" {
		return WithRequestID(rid)
	}
	return L()
}
func WithContext(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

func Debug(msg string, args ...any) { L().Debug(msg, args...) }
func Info(msg string, args ...any)  { L().Info(msg, args...) }
func Warn(msg string, args ...any)  { L().Warn(msg, args...) }
func Error(msg string, args ...any) { L().Error(msg, args...) }
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
func LogSecurityEvent(event, requestID, remoteAddr, detail string) {
	L().Warn("security_event",
		slog.String("event", event),
		slog.String("request_id", requestID),
		slog.String("remote_addr", remoteAddr),
		slog.String("detail", detail),
	)
}
func LogAuditEvent(action, userUID, collection, docID string) {
	L().Info("audit_event",
		slog.String("action", action),
		slog.String("user_uid", userUID),
		slog.String("collection", collection),
		slog.String("doc_id", docID),
		slog.Time("timestamp", time.Now().UTC()),
	)
}
