package config

import (
	"os"
	"testing"
	"time"
)

// ═══════════════════════════════════════════════════════════════════════════════
// Config & Environment — 18 Tests
// ═══════════════════════════════════════════════════════════════════════════════

func TestEnvString(t *testing.T) {
	t.Run("returns_existing_env_value", func(t *testing.T) {
		os.Setenv("TEST_ENV_STR_1", "hello")
		defer os.Unsetenv("TEST_ENV_STR_1")
		got := EnvString("TEST_ENV_STR_1", "default")
		if got != "hello" {
			t.Errorf("EnvString() = %q, want %q", got, "hello")
		}
	})

	t.Run("returns_default_when_missing", func(t *testing.T) {
		os.Unsetenv("TEST_ENV_STR_MISSING")
		got := EnvString("TEST_ENV_STR_MISSING", "fallback")
		if got != "fallback" {
			t.Errorf("EnvString() = %q, want %q", got, "fallback")
		}
	})

	t.Run("returns_default_when_empty", func(t *testing.T) {
		os.Setenv("TEST_ENV_STR_EMPTY", "")
		defer os.Unsetenv("TEST_ENV_STR_EMPTY")
		got := EnvString("TEST_ENV_STR_EMPTY", "default_val")
		if got != "default_val" {
			t.Errorf("EnvString() = %q, want %q", got, "default_val")
		}
	})
}

func TestEnvRequired(t *testing.T) {
	t.Run("returns_value_when_set", func(t *testing.T) {
		os.Setenv("TEST_REQ_1", "required_val")
		defer os.Unsetenv("TEST_REQ_1")
		got := EnvRequired("TEST_REQ_1")
		if got != "required_val" {
			t.Errorf("EnvRequired() = %q, want %q", got, "required_val")
		}
	})

	t.Run("panics_when_missing", func(t *testing.T) {
		os.Unsetenv("TEST_REQ_MISSING")
		defer func() {
			if r := recover(); r == nil {
				t.Error("EnvRequired() did not panic for missing env var")
			}
		}()
		EnvRequired("TEST_REQ_MISSING")
	})
}

func TestEnvInt(t *testing.T) {
	t.Run("parses_valid_integer", func(t *testing.T) {
		os.Setenv("TEST_INT_1", "42")
		defer os.Unsetenv("TEST_INT_1")
		got := EnvInt("TEST_INT_1", 0)
		if got != 42 {
			t.Errorf("EnvInt() = %d, want %d", got, 42)
		}
	})

	t.Run("returns_default_when_missing", func(t *testing.T) {
		os.Unsetenv("TEST_INT_MISSING")
		got := EnvInt("TEST_INT_MISSING", 99)
		if got != 99 {
			t.Errorf("EnvInt() = %d, want %d", got, 99)
		}
	})

	t.Run("returns_default_for_invalid_string", func(t *testing.T) {
		os.Setenv("TEST_INT_BAD", "not_a_number")
		defer os.Unsetenv("TEST_INT_BAD")
		got := EnvInt("TEST_INT_BAD", 77)
		if got != 77 {
			t.Errorf("EnvInt() = %d, want %d", got, 77)
		}
	})
}

func TestEnvBool(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		fallback bool
		want     bool
	}{
		{"true_string", "true", false, true},
		{"one_string", "1", false, true},
		{"yes_string", "yes", false, true},
		{"false_string", "false", true, false},
		{"zero_string", "0", true, false},
		{"no_string", "no", true, false},
		{"default_on_unknown", "maybe", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("TEST_BOOL", tt.value)
			defer os.Unsetenv("TEST_BOOL")
			got := EnvBool("TEST_BOOL", tt.fallback)
			if got != tt.want {
				t.Errorf("EnvBool(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestEnvDuration(t *testing.T) {
	t.Run("parses_valid_duration", func(t *testing.T) {
		os.Setenv("TEST_DUR", "5s")
		defer os.Unsetenv("TEST_DUR")
		got := EnvDuration("TEST_DUR", time.Second)
		if got != 5*time.Second {
			t.Errorf("EnvDuration() = %v, want %v", got, 5*time.Second)
		}
	})

	t.Run("returns_default_when_missing", func(t *testing.T) {
		os.Unsetenv("TEST_DUR_MISS")
		got := EnvDuration("TEST_DUR_MISS", 10*time.Second)
		if got != 10*time.Second {
			t.Errorf("EnvDuration() = %v, want %v", got, 10*time.Second)
		}
	})

	t.Run("returns_default_for_invalid", func(t *testing.T) {
		os.Setenv("TEST_DUR_BAD", "xyz")
		defer os.Unsetenv("TEST_DUR_BAD")
		got := EnvDuration("TEST_DUR_BAD", 3*time.Second)
		if got != 3*time.Second {
			t.Errorf("EnvDuration() = %v, want %v", got, 3*time.Second)
		}
	})
}

func TestEnvStringSlice(t *testing.T) {
	t.Run("parses_comma_separated", func(t *testing.T) {
		os.Setenv("TEST_SLICE", "a,b,c")
		defer os.Unsetenv("TEST_SLICE")
		got := EnvStringSlice("TEST_SLICE", nil)
		if len(got) != 3 || got[0] != "a" || got[1] != "b" || got[2] != "c" {
			t.Errorf("EnvStringSlice() = %v, want [a b c]", got)
		}
	})

	t.Run("returns_default_when_missing", func(t *testing.T) {
		os.Unsetenv("TEST_SLICE_MISS")
		def := []string{"x", "y"}
		got := EnvStringSlice("TEST_SLICE_MISS", def)
		if len(got) != 2 || got[0] != "x" {
			t.Errorf("EnvStringSlice() = %v, want %v", got, def)
		}
	})
}
