package main

import "flag"

// AppFlags holds the parsed CLI flags for the server binary.
type AppFlags struct {
	Port    string // HTTP listen port
	Env     string // Application environment
	Verbose bool   // Enable debug logging
}

// parseFlags parses command-line flags and returns an AppFlags struct.
// Flag values can be overridden by environment variables in main().
func parseFlags() *AppFlags {
	f := &AppFlags{}
	flag.StringVar(&f.Port, "port", "", "HTTP listen port (default: PORT env var or 8080)")
	flag.StringVar(&f.Env, "env", "", "Application environment: development|staging|production")
	flag.BoolVar(&f.Verbose, "verbose", false, "Enable verbose (debug) logging")
	flag.Parse()
	return f
}
