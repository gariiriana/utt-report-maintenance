// ============================================================================
// FILE: backend/cmd/api/server.go
// Deskripsi: Pengelola HTTP Web Server (Gin Router) di backend Go.
//            Mengatur konfigurasi timeout koneksi (ReadTimeout, WriteTimeout),
//            serta menangani Graceful Shutdown agar server mati dengan aman tanpa
//            memutus request aktif yang sedang diproses.
// ============================================================================

package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/routes"
)

// Struct Server membungkus instance http.Server standar Go
type Server struct {
	httpServer *http.Server
	Port       string
}

// Constructor untuk membuat instance Server dengan konfigurasi timeout aman
func NewServer(port string, handler http.Handler) *Server {
	return &Server{
		Port: port,
		httpServer: &http.Server{
			Addr:              ":" + port,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,   // Batas waktu baca header request
			ReadTimeout:       120 * time.Second, // Batas waktu total baca data request (untuk upload foto besar)
			WriteTimeout:      120 * time.Second, // Batas waktu kirim response ke client
			IdleTimeout:       120 * time.Second, // Batas waktu koneksi idle
			MaxHeaderBytes:    1 << 20,           // Maksimum ukuran header: 1MB
		},
	}
}

// Menjalankan HTTP listener pada port TCP yang ditentukan
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

	// Menunggu sinyal error atau pembatalan konteks (Shutdown)
	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("context cancelled, initiating graceful shutdown")
		return s.shutdown()
	}
}

// Melakukan Graceful Shutdown dalam durasi batas toleransi 15 detik
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

// Helper inisialisasi Server dari struktur dependensi (AppDeps)
func NewServerFromDeps(port string, deps *routes.AppDeps) (*Server, error) {
	handler := routes.SetupRouter(deps)
	return NewServer(port, handler), nil
}

// Helper inisialisasi Server langsung dari pembentukan router
func NewServerFromRouter(port string) (*Server, error) {
	deps, err := routes.NewAppDeps(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to init deps: %w", err)
	}
	return NewServerFromDeps(port, deps)
}
