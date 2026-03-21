package helpers

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
)

var validate *validator.Validate

func init() {
	validate = validator.New()

	// Register a custom tag name to use 'json' tags in error messages
	validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})
}

// ValidateStruct validates a struct using validator/v10 tags
// and returns a formatted AppError if validation fails.
func ValidateStruct(s interface{}) *apperrors.AppError {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}

	validationErr := &apperrors.ValidationError{}
	for _, err := range err.(validator.ValidationErrors) {
		field := err.Field()
		tag := err.Tag()
		param := err.Param()

		var message string
		switch tag {
		case "required":
			message = "is required"
		case "email":
			message = "must be a valid email address"
		case "min":
			message = fmt.Sprintf("must be at least %s characters", param)
		case "max":
			message = fmt.Sprintf("must be at most %s characters", param)
		case "oneof":
			message = fmt.Sprintf("must be one of: %s", param)
		case "url":
			message = "must be a valid URL"
		default:
			message = fmt.Sprintf("failed on %s validation", tag)
		}
		validationErr.Add(field, message)
	}

	return &apperrors.AppError{
		StatusCode: 400,
		Code:       apperrors.ErrCodeBadRequest,
		Message:    "Validation failed",
		Err:        validationErr,
	}
}
