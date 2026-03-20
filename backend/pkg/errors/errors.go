package errors

import (
	"fmt"
	"net/http"
)

// ErrorCode represents a typed application error code.
type ErrorCode string

const (
	// General errors
	ErrCodeInternal      ErrorCode = "INTERNAL_ERROR"
	ErrCodeNotFound      ErrorCode = "NOT_FOUND"
	ErrCodeUnauthorized  ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden     ErrorCode = "FORBIDDEN"
	ErrCodeBadRequest    ErrorCode = "BAD_REQUEST"
	ErrCodeConflict      ErrorCode = "CONFLICT"
	ErrCodeTimeout       ErrorCode = "TIMEOUT"
	ErrCodeRateLimit     ErrorCode = "RATE_LIMIT_EXCEEDED"

	// Domain-specific errors
	ErrCodeInvalidToken   ErrorCode = "INVALID_TOKEN"
	ErrCodeExpiredToken   ErrorCode = "EXPIRED_TOKEN"
	ErrCodeInvalidPayload ErrorCode = "INVALID_PAYLOAD"
	ErrCodeSaveFailed     ErrorCode = "SAVE_FAILED"
	ErrCodeQueryFailed    ErrorCode = "QUERY_FAILED"
	ErrCodeDeleteFailed   ErrorCode = "DELETE_FAILED"
)

// AppError is the standard application error that carries HTTP status,
// a machine-readable code, and a human-readable message.
type AppError struct {
	StatusCode int       `json:"-"`
	Code       ErrorCode `json:"code"`
	Message    string    `json:"message"`
	Details    string    `json:"details,omitempty"`
	Err        error     `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// ValidationError collects field-level validation failures.
type ValidationError struct {
	Fields map[string]string `json:"fields"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed on %d field(s)", len(e.Fields))
}

func (e *ValidationError) Add(field, message string) {
	if e.Fields == nil {
		e.Fields = make(map[string]string)
	}
	e.Fields[field] = message
}

func (e *ValidationError) HasErrors() bool {
	return len(e.Fields) > 0
}

// --- Constructor helpers ---

func New(code ErrorCode, message string) *AppError {
	return &AppError{
		StatusCode: codeToHTTP(code),
		Code:       code,
		Message:    message,
	}
}

func Wrap(code ErrorCode, message string, err error) *AppError {
	return &AppError{
		StatusCode: codeToHTTP(code),
		Code:       code,
		Message:    message,
		Err:        err,
	}
}

func NotFound(resource string) *AppError {
	return New(ErrCodeNotFound, fmt.Sprintf("%s not found", resource))
}

func Unauthorized(msg string) *AppError {
	return New(ErrCodeUnauthorized, msg)
}

func Forbidden(msg string) *AppError {
	return New(ErrCodeForbidden, msg)
}

func BadRequest(msg string) *AppError {
	return New(ErrCodeBadRequest, msg)
}

func Internal(err error) *AppError {
	return Wrap(ErrCodeInternal, "an internal server error occurred", err)
}

func RateLimit() *AppError {
	return New(ErrCodeRateLimit, "too many requests, please slow down")
}

// codeToHTTP maps ErrorCode to an appropriate HTTP status code.
func codeToHTTP(code ErrorCode) int {
	switch code {
	case ErrCodeNotFound:
		return http.StatusNotFound
	case ErrCodeUnauthorized, ErrCodeInvalidToken, ErrCodeExpiredToken:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeBadRequest, ErrCodeInvalidPayload:
		return http.StatusBadRequest
	case ErrCodeConflict:
		return http.StatusConflict
	case ErrCodeTimeout:
		return http.StatusGatewayTimeout
	case ErrCodeRateLimit:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}

// Is checks whether a target error is an AppError with a matching code.
func Is(err error, code ErrorCode) bool {
	if appErr, ok := err.(*AppError); ok {
		return appErr.Code == code
	}
	return false
}
