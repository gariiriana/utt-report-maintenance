package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/gariiriana/utt-report-maintenance/core/config"
)

func main() {
	config.MustLoadDotEnv(".env")
	flags := parseFlags()
	if flags.Port == "" {
		flags.Port = config.EnvString("PORT", "8080")
	}
	if flags.Verbose {
		os.Setenv("LOG_LEVEL", "debug")
	}
	logCfg := config.DefaultLoggerConfig()
	handler := config.BuildSlogHandler(logCfg)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("starting utt-report-maintenance backend",
		slog.String("port", flags.Port),
		slog.String("env", config.EnvString("APP_ENV", "production")),
	)
	app, err := bootstrap(flags)
	if err != nil {
		logger.Error("failed to bootstrap application", "error", err.Error())
		os.Exit(1)
	}
	ctx := context.Background()
	if err := app.Server.Run(ctx); err != nil {
		logger.Error("server exited with error", "error", err.Error())
		os.Exit(1)
	}
}
