package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

// Server wraps an http.Server with lifecycle management helpers.
type Server struct {
	httpServer *http.Server
	Port       string
}

// NewServer constructs a Server with sensible production timeouts.
func NewServer(port string, handler http.Handler) *Server {
	return &Server{
		Port: port,
		httpServer: &http.Server{
			Addr:              ":" + port,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       120 * time.Second,
			MaxHeaderBytes:    1 << 20, // 1 MiB
		},
	}
}

// Run starts the HTTP server and blocks until the context is cancelled,
// then initiates a graceful shutdown.
func (s *Server) Run(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.httpServer.Addr)
	if err != nil {
		return fmt.Errorf("failed to bind %s: %w", s.httpServer.Addr, err)
	}

	slog.Info("http server listening", slog.String("addr", s.httpServer.Addr))

	errCh := make(chan error, 1)
	go func() {
		if err := s.httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("context cancelled, initiating graceful shutdown")
		return s.shutdown()
	}
}

// shutdown gracefully stops the HTTP server with a 15-second timeout.
func (s *Server) shutdown() error {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	slog.Info("shutting down http server")
	if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown failed: %w", err)
	}
	slog.Info("http server stopped gracefully")
	return nil
}

// NewServerFromRouter is a convenience constructor that wires up the router
// and returns a ready Server.
func NewServerFromRouter(port string) (*Server, error) {
	handler, err := routes.SetupRouter()
	if err != nil {
		return nil, fmt.Errorf("router setup failed: %w", err)
	}
	return NewServer(port, handler), nil
}
