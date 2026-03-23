package routes

import (
	"fmt"
	"net/http"
	"strings"
)
type APIVersion string

const (
	V1 APIVersion = "v1"
	V2 APIVersion = "v2"
)
const CurrentVersion = V1
func VersionedPath(v APIVersion, path string) string {
	return fmt.Sprintf("/api/%s%s", v, path)
}
func StripVersionPrefix(path string) (cleanPath string, version string) {
	for _, v := range []APIVersion{V1, V2} {
		prefix := fmt.Sprintf("/api/%s", v)
		if strings.HasPrefix(path, prefix) {
			return strings.Replace(path, prefix, "/api", 1), string(v)
		}
	}
	return path, string(CurrentVersion)
}
func VersionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath, version := StripVersionPrefix(r.URL.Path)

		if cleanPath != r.URL.Path {
			w.Header().Set("X-API-Version", version)
			r2 := r.Clone(r.Context())
			r2.URL.Path = cleanPath
			next.ServeHTTP(w, r2)
			return
		}
		next.ServeHTTP(w, r)
	})
}
