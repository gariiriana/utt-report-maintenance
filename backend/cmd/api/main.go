// ============================================================================
// FILE: backend/cmd/api/main.go
// Deskripsi: Entry point (titik masuk utama) aplikasi server backend Go (Golang).
//            Memuat environment variable (.env), mengonfigurasi logger slog,
//            menjalankan bootstrap dependensi, dan mengaktifkan HTTP server pada port 8080.
// ============================================================================

package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/gariiriana/DwimitraSystem/backend/core/config"
)

func main() {
	// 1. Muat file .env dari berbagai kemungkinan path (akar proyek atau subfolder)
	config.MustLoadDotEnv(".env")
	config.MustLoadDotEnv("../.env")
	config.MustLoadDotEnv("../.env.local")

	// 2. Parse argumen command line (contoh: --port=8080 --verbose)
	flags := parseFlags()
	if flags.Port == "" {
		flags.Port = config.EnvString("PORT", "8080") // Default port: 8080
	}
	if flags.Verbose {
		os.Setenv("LOG_LEVEL", "debug")
	}

	// 3. Inisialisasi Structured Logging (slog) untuk pencatatan log aplikasi
	logCfg := config.DefaultLoggerConfig()
	handler := config.BuildSlogHandler(logCfg)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("starting utt-report-maintenance backend",
		slog.String("port", flags.Port),
		slog.String("env", config.EnvString("APP_ENV", "production")),
	)

	// 4. Inisialisasi seluruh dependensi server (Firebase Admin, Router, Controller, Service)
	app, err := bootstrap(flags)
	if err != nil {
		logger.Error("failed to bootstrap application", "error", err.Error())
		os.Exit(1)
	}

	// 5. Jalankan HTTP Web Server (Gin Framework) dengan penanganan Graceful Shutdown
	ctx := context.Background()
	if err := app.Server.Run(ctx); err != nil {
		logger.Error("server exited with error", "error", err.Error())
		os.Exit(1)
	}
}
