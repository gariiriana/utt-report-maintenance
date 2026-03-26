package main

import (
	"context"
	"fmt"

	"github.com/gariiriana/utt-report-maintenance/backend/core/routes"
)
type App struct {
	Server *Server
	Deps   *routes.AppDeps
}
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
