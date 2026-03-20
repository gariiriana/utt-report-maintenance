// Command utt-report-maintenance-backend starts the standalone HTTP server.
// This binary is used for local development and Docker deployments.
// For production Vercel deployments, the api/index.go entry point is used instead.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/config"
)

func main() {
	// Load .env for local development (no-op if file doesn't exist)
	config.MustLoadDotEnv(".env")

	// Parse CLI flags
	flags := parseFlags()
	if flags.Port == "" {
		flags.Port = config.EnvString("PORT", "8080")
	}
	if flags.Verbose {
		os.Setenv("LOG_LEVEL", "debug")
	}

	// Initialise structured logger
	logCfg := config.DefaultLoggerConfig()
	handler := config.BuildSlogHandler(logCfg)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("starting utt-report-maintenance backend",
		slog.String("port", flags.Port),
		slog.String("env", config.EnvString("APP_ENV", "production")),
	)

	// Bootstrap application (wires dependencies)
	app, err := bootstrap(flags)
	if err != nil {
		logger.Error("failed to bootstrap application", "error", err.Error())
		os.Exit(1)
	}

	// Run with graceful shutdown
	ctx := context.Background()
	if err := app.Server.Run(ctx); err != nil {
		logger.Error("server exited with error", "error", err.Error())
		os.Exit(1)
	}
}
