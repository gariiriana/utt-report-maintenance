package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// GracefulShutdownConfig holds configuration for graceful shutdown behaviour.
type GracefulShutdownConfig struct {
	// Timeout is the maximum time to wait for in-flight requests to complete.
	Timeout time.Duration
	// Signals is the list of OS signals that will trigger a shutdown.
	Signals []os.Signal
}

// DefaultGracefulShutdownConfig returns sensible defaults for production.
func DefaultGracefulShutdownConfig() GracefulShutdownConfig {
	return GracefulShutdownConfig{
		Timeout: 15 * time.Second,
		Signals: []os.Signal{syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT},
	}
}

// WaitForShutdownSignal blocks until one of the configured OS signals is received,
// then cancels the returned context to trigger application shutdown.
// It returns a cleanup function that should be deferred by the caller.
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
