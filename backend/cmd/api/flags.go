package main

import "flag"
type AppFlags struct {
	Port    string
	Env     string
	Verbose bool
}
func parseFlags() *AppFlags {
	f := &AppFlags{}
	flag.StringVar(&f.Port, "port", "", "HTTP listen port (default: PORT env var or 8080)")
	flag.StringVar(&f.Env, "env", "", "Application environment: development|staging|production")
	flag.BoolVar(&f.Verbose, "verbose", false, "Enable verbose (debug) logging")
	flag.Parse()
	return f
}
