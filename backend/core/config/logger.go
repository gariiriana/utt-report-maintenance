package config

import (
	"io"
	"log/slog"
	"os"
)
type LoggerConfig struct {
	Level     slog.Level
	Format    string // "json" | "text"
	AddSource bool
	Output    io.Writer
}
func DefaultLoggerConfig() LoggerConfig {
	lvl := parseLogLevel(EnvString("LOG_LEVEL", "info"))
	format := EnvString("LOG_FORMAT", "json")
	return LoggerConfig{
		Level:     lvl,
		Format:    format,
		AddSource: EnvBool("LOG_ADD_SOURCE", false),
		Output:    os.Stdout,
	}
}
func BuildSlogHandler(cfg LoggerConfig) slog.Handler {
	opts := &slog.HandlerOptions{
		Level:     cfg.Level,
		AddSource: cfg.AddSource,
	}
	out := cfg.Output
	if out == nil {
		out = os.Stdout
	}
	if cfg.Format == "text" {
		return slog.NewTextHandler(out, opts)
	}
	return slog.NewJSONHandler(out, opts)
}
func parseLogLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
