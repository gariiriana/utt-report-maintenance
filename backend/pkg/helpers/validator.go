package helpers

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	uuidRegex  = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// Validator accumulates field-level validation errors.
type Validator struct {
	errors *apperrors.ValidationError
}

// NewValidator creates a fresh Validator instance.
func NewValidator() *Validator {
	return &Validator{errors: &apperrors.ValidationError{}}
}

// Required asserts that a string field is non-empty after trimming.
func (v *Validator) Required(field, value string) *Validator {
	if strings.TrimSpace(value) == "" {
		v.errors.Add(field, fmt.Sprintf("%s is required", field))
	}
	return v
}

// MaxLength asserts a string field does not exceed maxLen runes.
func (v *Validator) MaxLength(field, value string, maxLen int) *Validator {
	if utf8.RuneCountInString(value) > maxLen {
		v.errors.Add(field, fmt.Sprintf("%s must be at most %d characters", field, maxLen))
	}
	return v
}

// MinLength asserts a string field is at least minLen runes long.
func (v *Validator) MinLength(field, value string, minLen int) *Validator {
	if utf8.RuneCountInString(strings.TrimSpace(value)) < minLen {
		v.errors.Add(field, fmt.Sprintf("%s must be at least %d characters", field, minLen))
	}
	return v
}

// Email asserts a string field is a valid email address.
func (v *Validator) Email(field, value string) *Validator {
	if value != "" && !emailRegex.MatchString(value) {
		v.errors.Add(field, fmt.Sprintf("%s is not a valid email address", field))
	}
	return v
}

// UUID asserts a string field is a valid UUID v4.
func (v *Validator) UUID(field, value string) *Validator {
	if value != "" && !uuidRegex.MatchString(value) {
		v.errors.Add(field, fmt.Sprintf("%s must be a valid UUID", field))
	}
	return v
}

// OneOf asserts a string field's value is one of the allowed values.
func (v *Validator) OneOf(field, value string, allowed []string) *Validator {
	for _, a := range allowed {
		if value == a {
			return v
		}
	}
	v.errors.Add(field, fmt.Sprintf("%s must be one of: %s", field, strings.Join(allowed, ", ")))
	return v
}

// NotFuture asserts a time.Time field is not in the future.
func (v *Validator) NotFuture(field string, t time.Time) *Validator {
	if t.After(time.Now().UTC()) {
		v.errors.Add(field, fmt.Sprintf("%s cannot be in the future", field))
	}
	return v
}

// Custom allows an arbitrary validation function.
// fn should return an empty string on success or an error message on failure.
func (v *Validator) Custom(field string, fn func() string) *Validator {
	if msg := fn(); msg != "" {
		v.errors.Add(field, msg)
	}
	return v
}

// Err returns the accumulated ValidationError, or nil if there are no errors.
func (v *Validator) Err() *apperrors.ValidationError {
	if v.errors.HasErrors() {
		return v.errors
	}
	return nil
}

// IsValidCollection checks whether a collection name is in the allowed list.
func IsValidCollection(name string, allowed map[string]bool) bool {
	return allowed[name]
}

// IsNonEmptyMap returns true if the map is non-nil and has at least one key.
func IsNonEmptyMap(m map[string]interface{}) bool {
	return len(m) > 0
}
