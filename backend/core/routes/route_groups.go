package routes

import "net/http"
type Group struct {
	prefix      string
	middlewares []MiddlewareFunc
	deps        *AppDeps
}
func NewGroup(prefix string, deps *AppDeps, mws ...MiddlewareFunc) *Group {
	return &Group{prefix: prefix, middlewares: mws, deps: deps}
}
func (g *Group) Apply(h http.Handler) http.Handler {
	return BuildMiddlewareChain(g.middlewares...)(h)
}
func PublicGroup(deps *AppDeps) *Group {
	return NewGroup("/api", deps)
}
func AuthGroup(deps *AppDeps) *Group {
	return NewGroup("/api", deps, deps.RateLimiter.Middleware)
}
func AdminGroup(deps *AppDeps) *Group {
	return NewGroup("/api/admin", deps, deps.RateLimiter.Middleware)
}
func Routes() []struct{ Method, Path, Description string } {
	return []struct{ Method, Path, Description string }{
		{"GET", "/health", "Liveness probe"},
		{"GET", "/ready", "Readiness probe"},
		{"GET", "/metrics", "Runtime metrics"},
		{"POST", "/api/auth/login", "Firebase token login"},
		{"POST", "/api/auth/logout", "Revoke tokens"},
		{"GET", "/api/auth/me", "Authenticated user profile"},
		{"POST", "/api/report", "Create report"},
		{"GET", "/api/reports", "List reports"},
		{"GET", "/api/report/{collection}/{id}", "Get report by ID"},
		{"DELETE", "/api/report/{collection}/{id}", "Delete report"},
		{"GET", "/api/users", "List users (admin)"},
		{"GET", "/api/users/{uid}", "Get user profile"},
		{"PATCH", "/api/users/{uid}/role", "Update user role (admin)"},
		{"DELETE", "/api/users/{uid}", "Deactivate user (admin)"},
		{"GET", "/api/archive", "List archives"},
		{"GET", "/api/archive/{id}", "Get archived document"},
		{"DELETE", "/api/archive/{id}", "Permanently delete archive (admin)"},
		{"GET", "/api/audit", "Get all audit logs (admin)"},
		{"GET", "/api/audit/me", "Get my audit log"},
	}
}
