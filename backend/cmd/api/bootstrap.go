package main

import "fmt"

// App holds all wired application components.
type App struct {
	Server *Server
}

// bootstrap wires all dependencies together and returns a ready-to-start App.
func bootstrap(flags *AppFlags) (*App, error) {
	if flags.Env != "" {
		// APP_ENV can also be set via -env flag before this call
	}

	server, err := NewServerFromRouter(flags.Port)
	if err != nil {
		return nil, fmt.Errorf("bootstrap: %w", err)
	}

	return &App{Server: server}, nil
}
