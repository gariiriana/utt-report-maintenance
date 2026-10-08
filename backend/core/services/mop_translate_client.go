// ============================================================================
// FILE: backend/core/services/mop_translate_client.go
// Deskripsi: Klien chat AI untuk penerjemah Bilingual MOP. Memakai endpoint
//            OpenAI-compatible yang sama dengan fitur AI lain (NVIDIA_NIM_BASE_URL:
//            Google Gemini atau NVIDIA NIM, keduanya tier gratis) beserta pool
//            API key-nya, tetapi dengan model yang lebih kuat untuk terjemahan.
//            Model yang tidak tersedia dilewati otomatis ke model berikutnya.
// ============================================================================

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/config"
)

// ErrMOPRateLimited: kuota per menit layanan AI gratis sedang habis.
var ErrMOPRateLimited = errors.New("layanan AI gratis sedang padat (batas kuota per menit), coba lagi sebentar")

var mopRetryDelayRe = regexp.MustCompile(`"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"`)

// mopCompleter mengirim satu percakapan (system + user) ke model AI.
type mopCompleter interface {
	Complete(ctx context.Context, system, user string) (string, error)
}

type mopChatClient struct {
	baseURL     string
	apiKeys     []string
	models      []string
	keyIndex    uint64
	modelIndex  atomic.Int64 // model pertama yang masih tersedia; dipakai ulang antar-permintaan
	noReasoning atomic.Bool  // endpoint menolak parameter reasoning_effort
	httpClient  *http.Client
}

func isGeminiEndpoint(baseURL string) bool {
	return strings.Contains(baseURL, "generativelanguage.googleapis.com")
}

// mopTranslateModels: urutan model yang dicoba. Model terjemahan yang kuat dulu, lalu model
// teks yang sudah dipakai fitur AI lain sebagai cadangan terakhir.
func mopTranslateModels(baseURL string) []string {
	candidates := config.EnvStringSlice("MOP_TRANSLATE_MODELS", nil)
	if len(candidates) == 0 {
		if isGeminiEndpoint(baseURL) {
			candidates = []string{"models/gemini-3-flash-preview", "models/gemini-2.5-flash"}
		} else {
			candidates = []string{"deepseek-ai/deepseek-v4-flash", "meta/llama-3.3-70b-instruct"}
		}
	}
	candidates = append(candidates, config.EnvString("NVIDIA_NIM_REASONING_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "")))

	seen := make(map[string]bool, len(candidates))
	models := make([]string, 0, len(candidates))
	for _, m := range candidates {
		if m = strings.TrimSpace(m); m != "" && !seen[m] {
			seen[m] = true
			models = append(models, m)
		}
	}
	return models
}

// aiAPIKeys mengambil pool API key milik AI service (NVIDIA_NIM_API_KEYS + cadangan bawaan)
// agar penerjemah MOP memakai kuota gratis yang sama.
func aiAPIKeys(ai IAIService) []string {
	if s, ok := ai.(*aiService); ok {
		return s.apiKeys
	}
	return nil
}

func newMOPChatClient(keys []string) *mopChatClient {
	baseURL := config.EnvString("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
	models := mopTranslateModels(baseURL)
	if len(keys) == 0 || len(models) == 0 {
		return nil
	}
	return &mopChatClient{
		baseURL:    baseURL,
		apiKeys:    keys,
		models:     models,
		httpClient: &http.Client{},
	}
}

func (c *mopChatClient) nextKey() string {
	idx := atomic.AddUint64(&c.keyIndex, 1)
	return c.apiKeys[idx%uint64(len(c.apiKeys))]
}

func (c *mopChatClient) post(ctx context.Context, model, apiKey, system, user string) (int, []byte, error) {
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature": 0.1,
		"max_tokens":  8192,
		"stream":      false,
	}
	// Model Gemini "berpikir" dulu secara default; untuk terjemahan cukup sedikit agar tetap di bawah batas waktu.
	if isGeminiEndpoint(c.baseURL) && !c.noReasoning.Load() {
		payload["reasoning_effort"] = "low"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	return resp.StatusCode, respBody, err
}

func parseMOPChatContent(body []byte) (string, error) {
	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("respons AI tidak dapat dibaca: %w", err)
	}
	if len(chatResp.Choices) == 0 {
		return "", errors.New("AI tidak mengembalikan jawaban")
	}
	content := chatResp.Choices[0].Message.Content
	// Model penalaran (mis. DeepSeek) dapat menyertakan blok <think> sebelum jawaban.
	if idx := strings.LastIndex(content, "</think>"); idx != -1 {
		content = content[idx+len("</think>"):]
	}
	if strings.TrimSpace(content) == "" {
		return "", errors.New("AI mengembalikan jawaban kosong")
	}
	return content, nil
}

func isModelUnavailable(status int, body string) bool {
	lower := strings.ToLower(body)
	switch {
	case status == http.StatusNotFound:
		return true
	case status == http.StatusBadRequest && strings.Contains(lower, "model") &&
		(strings.Contains(lower, "not found") || strings.Contains(lower, "not supported") || strings.Contains(lower, "does not exist") || strings.Contains(lower, "invalid model")):
		return true
	case status == http.StatusTooManyRequests && strings.Contains(lower, "limit: 0"):
		// Gemini: model tanpa kuota tier gratis.
		return true
	}
	return false
}

// rateLimitWait membaca retryDelay dari respons Gemini; selain itu backoff bertahap.
func rateLimitWait(body string, attempt int) time.Duration {
	if m := mopRetryDelayRe.FindStringSubmatch(body); m != nil {
		if secs, err := strconv.ParseFloat(m[1], 64); err == nil {
			return time.Duration(secs*float64(time.Second)) + 500*time.Millisecond
		}
	}
	wait := time.Duration(attempt) * 2 * time.Second
	if wait > 8*time.Second {
		wait = 8 * time.Second
	}
	return wait
}

// sleepWithin menunggu selama d bila setelahnya masih tersisa minimal `keep` sebelum tenggat ctx.
func sleepWithin(ctx context.Context, d, keep time.Duration) bool {
	if deadline, ok := ctx.Deadline(); ok && time.Until(deadline) < d+keep {
		return false
	}
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

func (c *mopChatClient) Complete(ctx context.Context, system, user string) (string, error) {
	maxAttempts := len(c.apiKeys) * 2
	if maxAttempts < 3 {
		maxAttempts = 3
	}
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; {
		if ctx.Err() != nil {
			break
		}
		mi := int(c.modelIndex.Load())
		if mi >= len(c.models) {
			return "", fmt.Errorf("tidak ada model AI yang tersedia untuk penerjemahan: %v", lastErr)
		}
		model := c.models[mi]

		status, body, err := c.post(ctx, model, c.nextKey(), system, user)
		bodyStr := string(body)
		switch {
		case err != nil:
			lastErr = err
			attempt++
		case status == http.StatusOK:
			content, perr := parseMOPChatContent(body)
			if perr == nil {
				slog.Info("mop_translate_ai_ok", slog.String("model", model), slog.Int("attempt", attempt))
				return content, nil
			}
			lastErr = perr
			attempt++
		case isModelUnavailable(status, bodyStr):
			slog.Warn("mop_translate_model_unavailable", slog.String("model", model), slog.Int("status", status))
			lastErr = fmt.Errorf("model %s tidak tersedia (HTTP %d)", model, status)
			c.modelIndex.CompareAndSwap(int64(mi), int64(mi+1))
		case status == http.StatusBadRequest && strings.Contains(strings.ToLower(bodyStr), "reasoning") && !c.noReasoning.Load():
			c.noReasoning.Store(true)
		case status == http.StatusTooManyRequests:
			lastErr = ErrMOPRateLimited
			attempt++
			if !sleepWithin(ctx, rateLimitWait(bodyStr, attempt), 15*time.Second) {
				return "", ErrMOPRateLimited
			}
		case status == http.StatusUnauthorized || status == http.StatusForbidden || status >= 500:
			lastErr = fmt.Errorf("AI API error (%d): %.200s", status, bodyStr)
			attempt++
			sleepWithin(ctx, 500*time.Millisecond, 0)
		default:
			return "", fmt.Errorf("AI API error (%d): %.300s", status, bodyStr)
		}
	}

	if lastErr == nil {
		lastErr = ctx.Err()
	}
	return "", lastErr
}
