package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gariiriana/utt-report-maintenance/backend/core/middlewares"
	"github.com/gariiriana/utt-report-maintenance/backend/core/routes"
)

var (
	handler     http.HandlerFunc
	initOnce    sync.Once
	initError   error
)

func initialize() {
	initOnce.Do(func() {
		ctx := context.Background()
		deps, err := routes.NewAppDeps(ctx)
		if err != nil {
			initError = err
			return
		}
		handler = routes.SetupRouter(deps)
	})
}

func Handler(w http.ResponseWriter, r *http.Request) {
	initialize()
	if initError != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"error","message":"Service temporarily unavailable. Please try again later."}`))
		return
	}

	if r.URL.Path == "/api/test" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","message":"Root Bridge is working"}`))
		return
	}

	if r.URL.Path == "/api/debug-env" {
		w.Header().Set("Content-Type", "application/json")
		baseUrl := os.Getenv("NVIDIA_NIM_BASE_URL")
		keys := os.Getenv("NVIDIA_NIM_API_KEYS")
		visionModel := os.Getenv("NVIDIA_NIM_VISION_MODEL")
		reasoningModel := os.Getenv("NVIDIA_NIM_REASONING_MODEL")
		chatModel := os.Getenv("NVIDIA_NIM_CHAT_MODEL")
		model := os.Getenv("NVIDIA_NIM_MODEL")

		maskedKeys := ""
		if keys != "" {
			parts := strings.Split(keys, ",")
			for i, p := range parts {
				p = strings.TrimSpace(p)
				if len(p) > 6 {
					parts[i] = p[:3] + "..." + p[len(p)-3:]
				} else {
					parts[i] = "..."
				}
			}
			maskedKeys = strings.Join(parts, ",")
		}

		response := map[string]interface{}{
			"NVIDIA_NIM_BASE_URL":        baseUrl,
			"NVIDIA_NIM_API_KEYS_MASK":   maskedKeys,
			"NVIDIA_NIM_VISION_MODEL":    visionModel,
			"NVIDIA_NIM_REASONING_MODEL":  reasoningModel,
			"NVIDIA_NIM_CHAT_MODEL":      chatModel,
			"NVIDIA_NIM_MODEL":           model,
		}
		bytes, _ := json.Marshal(response)
		w.Write(bytes)
		return
	}

	w.Header().Set("X-Backend-Handler", "go-root-bridge")
	if isOptions := middlewares.EnableCORS(w, r); isOptions {
		return
	}

	handler(w, r)
}
