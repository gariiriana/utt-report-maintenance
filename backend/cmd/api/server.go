package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/core/routes"
)
type Server struct {
	httpServer *http.Server
	Port       string
}
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
			MaxHeaderBytes:    1 << 20,
		},
	}
}
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
func NewServerFromDeps(port string, deps *routes.AppDeps) (*Server, error) {
	handler := routes.SetupRouter(deps)
	return NewServer(port, handler), nil
}
func NewServerFromRouter(port string) (*Server, error) {
	deps, err := routes.NewAppDeps(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to init deps: %w", err)
	}
	return NewServerFromDeps(port, deps)
}
