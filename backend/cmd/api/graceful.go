// ============================================================================
// FILE: backend/cmd/api/graceful.go
// Deskripsi: Penanganan Sinyal Shutdown OS (SIGINT, SIGTERM, SIGQUIT).
//            Memastikan saat server di-stop (misal: Ctrl+C atau terminasi Docker/K8s),
//            server melakukan pembatalan context secara tertib dengan timeout 15s.
// ============================================================================

package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// Konfigurasi durasi timeout & daftar sinyal OS
type GracefulShutdownConfig struct {
	Timeout time.Duration
	Signals []os.Signal
}

// Konfigurasi default penanganan sinyal shutdown
func DefaultGracefulShutdownConfig() GracefulShutdownConfig {
	return GracefulShutdownConfig{
		Timeout: 15 * time.Second,
		Signals: []os.Signal{syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT},
	}
}

// Mendengarkan sinyal terminasi dari Sistem Operasi
func WaitForShutdownSignal(cfg GracefulShutdownConfig) (ctx context.Context, stop func()) {
	ctx, cancel := context.WithCancel(context.Background())

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, cfg.Signals...)

	go func() {
		sig := <-sigCh
		slog.Info("shutdown signal received",
			slog.String("signal", sig.String()),
			slog.Duration("timeout", cfg.Timeout),
		)
		cancel()
	}()

	return ctx, func() {
		signal.Stop(sigCh)
		close(sigCh)
	}
}
