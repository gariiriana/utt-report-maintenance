// ============================================================================
// FILE: backend/cmd/api/flags.go
// Deskripsi: Parser argumen command line (CLI flags) untuk backend Go.
//            Mendukung parameter --port, --env, dan --verbose.
// ============================================================================

package main

import "flag"

// Struct AppFlags menampung nilai opsi yang di-parse dari terminal
type AppFlags struct {
	Port    string // Port HTTP (misal: "8080")
	Env     string // Environment (development / staging / production)
	Verbose bool   // Mode verbose/debug logging
}

// Parsing argumen terminal CLI
func parseFlags() *AppFlags {
	f := &AppFlags{}
	flag.StringVar(&f.Port, "port", "", "HTTP listen port (default: PORT env var or 8080)")
	flag.StringVar(&f.Env, "env", "", "Application environment: development|staging|production")
	flag.BoolVar(&f.Verbose, "verbose", false, "Enable verbose (debug) logging")
	flag.Parse()
	return f
}
