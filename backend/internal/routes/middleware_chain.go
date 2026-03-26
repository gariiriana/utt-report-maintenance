package routes

import "net/http"
type MiddlewareFunc func(http.Handler) http.Handler
func BuildMiddlewareChain(middlewares ...MiddlewareFunc) MiddlewareFunc {
	return func(final http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}
func ChainHandlers(h http.Handler, mws ...MiddlewareFunc) http.Handler {
	return BuildMiddlewareChain(mws...)(h)
}
