package routes

import "net/http"

// MiddlewareFunc is an HTTP middleware function signature.
type MiddlewareFunc func(http.Handler) http.Handler

// BuildMiddlewareChain composes a series of middleware functions into a single handler wrapper.
// Middleware is applied in the given order (leftmost = outermost).
func BuildMiddlewareChain(middlewares ...MiddlewareFunc) MiddlewareFunc {
	return func(final http.Handler) http.Handler {
		// Build chain from right to left so the first middleware is outermost
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// ChainHandlers converts a variadic list of MiddlewareFunc and a final handler
// into a single http.Handler.
func ChainHandlers(h http.Handler, mws ...MiddlewareFunc) http.Handler {
	return BuildMiddlewareChain(mws...)(h)
}
