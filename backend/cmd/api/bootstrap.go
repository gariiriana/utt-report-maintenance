// ============================================================================
// FILE: backend/cmd/api/bootstrap.go
// Deskripsi: Fungsi Inisialisasi (Bootstrap) aplikasi backend Go.
//            Menghubungkan layanan Firestore, AI Gemini Service, Controller,
//            dan HTTP Server ke dalam satu kontainer aplikasi (App struct).
// ============================================================================

package main

import (
	"context"
	"fmt"

	"github.com/gariiriana/DwimitraSystem/backend/core/routes"
)

// Struct App menampung pointer server HTTP & seluruh dependensi aplikasi
type App struct {
	Server *Server
	Deps   *routes.AppDeps
}

// Fungsi bootstrap membangun router & instansiasi dependensi dari environment
func bootstrap(flags *AppFlags) (*App, error) {
	ctx := context.Background()
	deps, err := routes.NewAppDeps(ctx)
	if err != nil {
		return nil, fmt.Errorf("bootstrap: %w", err)
	}

	server, err := NewServerFromDeps(flags.Port, deps)
	if err != nil {
		return nil, fmt.Errorf("bootstrap (server): %w", err)
	}

	return &App{
		Server: server,
		Deps:   deps,
	}, nil
}
