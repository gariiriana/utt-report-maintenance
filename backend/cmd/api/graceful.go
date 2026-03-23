package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)
type GracefulShutdownConfig struct {
	Timeout time.Duration
	Signals []os.Signal
}
func DefaultGracefulShutdownConfig() GracefulShutdownConfig {
	return GracefulShutdownConfig{
		Timeout: 15 * time.Second,
		Signals: []os.Signal{syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT},
	}
}
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
