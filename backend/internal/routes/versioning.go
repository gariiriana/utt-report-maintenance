package routes

import (
	"fmt"
	"net/http"
	"strings"
)

// APIVersion defines a supported API version.
type APIVersion string

const (
	V1 APIVersion = "v1"
	V2 APIVersion = "v2"
)

// CurrentVersion is the default API version served when no version prefix is given.
const CurrentVersion = V1

// VersionedPath prefixes a path with the API version prefix.
// Example: VersionedPath(V1, "/reports") → "/api/v1/reports"
func VersionedPath(v APIVersion, path string) string {
	return fmt.Sprintf("/api/%s%s", v, path)
}

// StripVersionPrefix removes the version prefix from a request path,
// allowing the router to handle versioned and unversioned paths identically.
// Returns the cleaned path and the detected version string.
func StripVersionPrefix(path string) (cleanPath string, version string) {
	for _, v := range []APIVersion{V1, V2} {
		prefix := fmt.Sprintf("/api/%s", v)
		if strings.HasPrefix(path, prefix) {
			return strings.Replace(path, prefix, "/api", 1), string(v)
		}
	}
	return path, string(CurrentVersion)
}

// VersionMiddleware is an HTTP middleware that normalises versioned URL paths,
// allowing /api/v1/report and /api/report to be handled by the same router.
func VersionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath, version := StripVersionPrefix(r.URL.Path)

		if cleanPath != r.URL.Path {
			// Expose extracted version in header for debugging
			w.Header().Set("X-API-Version", version)
			r2 := r.Clone(r.Context())
			r2.URL.Path = cleanPath
			next.ServeHTTP(w, r2)
			return
		}
		next.ServeHTTP(w, r)
	})
}
