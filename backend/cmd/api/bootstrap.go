package main

import (
	"context"
	"fmt"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/routes"
)

// App holds all wired application components.
type App struct {
	Server *Server
	Deps   *routes.AppDeps
}

// bootstrap wires all dependencies together and returns a ready-to-start App.
func bootstrap(flags *AppFlags) (*App, error) {
	ctx := context.Background()

	// Initialise all dependencies using the central helper
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
