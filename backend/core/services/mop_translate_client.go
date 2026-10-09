// ============================================================================
// FILE: backend/core/services/mop_translate_client.go
// Deskripsi: Klien chat AI untuk penerjemah Bilingual MOP. Memakai endpoint
//            OpenAI-compatible yang sama dengan fitur AI lain (NVIDIA_NIM_BASE_URL:
//            Google Gemini atau NVIDIA NIM, keduanya tier gratis) beserta pool
//            API key-nya, tetapi dengan model yang lebih kuat untuk terjemahan.
//            Key yang kena batas kuota (429) langsung diganti key lain; bila semua
//            key untuk satu model sedang kena batas, pindah ke model cadangan.
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
	"sync"
	"sync/atomic"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/config"
)

// ErrMOPRateLimited: semua API key dan model cadangan sedang kena batas kuota layanan AI gratis.
var ErrMOPRateLimited = errors.New("semua API key AI gratis sedang kena batas kuota, coba lagi 1-2 menit lagi")

var mopRetryDelayRe = regexp.MustCompile(`"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"`)

// Lama sebuah kombinasi model+key diistirahatkan setelah ditolak.
const (
	mopCooldownUnavailable = time.Hour        // model tidak ada / tanpa kuota gratis di project key ini
	mopCooldownDailyQuota  = time.Hour        // kuota harian habis, tidak pulih dalam hitungan detik
	mopCooldownKeyRejected = 10 * time.Minute // key ditolak (401/403)
	mopCooldownServerBusy  = 5 * time.Second  // server AI sedang sibuk (5xx)
	mopCooldownHung        = time.Minute      // model tidak menjawab dalam mopAttemptTimeout
)

// mopAttemptTimeout: 25 paragraf biasanya dijawab dalam 2-15 detik. Panggilan yang menggantung
// diputus agar sisa waktu permintaan masih cukup untuk mencoba key/model lain.
var mopAttemptTimeout = 30 * time.Second

// mopRoute adalah satu kombinasi model + API key (index ke mopChatClient.models / apiKeys).
type mopRoute struct{ model, key int }

// mopCompleter mengirim satu percakapan (system + user) ke model AI.
type mopCompleter interface {
	Complete(ctx context.Context, system, user string) (string, error)
}

type mopChatClient struct {
	baseURL     string
	apiKeys     []string
	models      []string
	noReasoning atomic.Bool // endpoint menolak parameter reasoning_effort
	httpClient  *http.Client

	mu       sync.Mutex
	keyIndex int                    // giliran key berikutnya
	cooldown map[mopRoute]time.Time // kombinasi yang sedang diistirahatkan sampai waktu ini; dipakai ulang antar-permintaan
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
			// gemini-2.5-flash sudah ditutup untuk project baru (404). Kuota tier gratis dihitung
			// per model, jadi model Flash cadangan menambah kapasitas saat model utama kena batas.
			// gemini-3.6/3.7-flash tidak dipakai: saat diuji sesekali menggantung sampai batas waktu.
			candidates = []string{"models/gemini-3-flash-preview", "models/gemini-3.5-flash"}
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
		cooldown:   make(map[mopRoute]time.Time),
	}
}

// pickRoute memilih kombinasi model+key berikutnya: model sesuai urutan (yang terbaik dulu),
// key bergiliran, dan kombinasi yang sedang istirahat dilewati. Jadi key yang kena batas kuota
// langsung diganti key lain, lalu model cadangan. Bila semuanya istirahat, ok=false dan wait
// berisi jeda sampai kombinasi pertama pulih.
func (c *mopChatClient) pickRoute() (route mopRoute, wait time.Duration, ok bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	c.keyIndex = (c.keyIndex + 1) % len(c.apiKeys)
	start := c.keyIndex
	for m := range c.models {
		for i := range c.apiKeys {
			r := mopRoute{model: m, key: (start + i) % len(c.apiKeys)}
			until, resting := c.cooldown[r]
			if !resting || !until.After(now) {
				return r, 0, true
			}
			if d := until.Sub(now); wait == 0 || d < wait {
				wait = d
			}
		}
	}
	return mopRoute{}, wait, false
}

func (c *mopChatClient) rest(r mopRoute, d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cooldown[r] = time.Now().Add(d)
}

// restModel mengistirahatkan satu model untuk semua key (masalahnya ada di model, bukan key).
func (c *mopChatClient) restModel(model int, d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	until := time.Now().Add(d)
	for k := range c.apiKeys {
		c.cooldown[mopRoute{model: model, key: k}] = until
	}
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

// rateLimitCooldown: lama istirahat kombinasi model+key setelah 429. Kuota harian yang habis
// diistirahatkan sejam; batas per menit mengikuti retryDelay dari Gemini.
func rateLimitCooldown(body string, attempt int) time.Duration {
	if strings.Contains(body, "PerDay") {
		return mopCooldownDailyQuota
	}
	return rateLimitWait(body, attempt)
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
	maxFailures := len(c.apiKeys) * 2
	if maxFailures < 3 {
		maxFailures = 3
	}
	// 429 tidak dihitung sebagai kegagalan (langsung pindah key/model), tetapi tetap dibatasi.
	maxRateLimits := len(c.apiKeys) * len(c.models) * 3
	var lastErr error
	failures, rateLimits := 0, 0

	for failures < maxFailures && rateLimits < maxRateLimits && ctx.Err() == nil {
		route, wait, ok := c.pickRoute()
		if !ok {
			// Semua kombinasi sedang istirahat: tunggu yang paling cepat pulih bila waktunya masih cukup.
			if sleepWithin(ctx, wait, 15*time.Second) {
				continue
			}
			if lastErr == nil || errors.Is(lastErr, ErrMOPRateLimited) {
				return "", ErrMOPRateLimited
			}
			return "", fmt.Errorf("tidak ada model AI yang tersedia untuk penerjemahan: %v", lastErr)
		}
		model := c.models[route.model]

		attemptCtx, cancel := context.WithTimeout(ctx, mopAttemptTimeout)
		status, body, err := c.post(attemptCtx, model, c.apiKeys[route.key], system, user)
		hung := err != nil && attemptCtx.Err() != nil && ctx.Err() == nil
		cancel()
		bodyStr := string(body)
		switch {
		case hung:
			slog.Warn("mop_translate_attempt_timeout", slog.String("model", model), slog.Int("key", route.key+1))
			lastErr = fmt.Errorf("model %s tidak menjawab dalam %v", model, mopAttemptTimeout)
			failures++
			c.restModel(route.model, mopCooldownHung)
		case err != nil:
			lastErr = err
			failures++
		case status == http.StatusOK:
			content, perr := parseMOPChatContent(body)
			if perr == nil {
				slog.Info("mop_translate_ai_ok", slog.String("model", model), slog.Int("key", route.key+1), slog.Int("rate_limited", rateLimits))
				return content, nil
			}
			lastErr = perr
			failures++
		case isModelUnavailable(status, bodyStr):
			slog.Warn("mop_translate_model_unavailable", slog.String("model", model), slog.Int("key", route.key+1), slog.Int("status", status))
			lastErr = fmt.Errorf("model %s tidak tersedia (HTTP %d)", model, status)
			c.rest(route, mopCooldownUnavailable)
		case status == http.StatusBadRequest && strings.Contains(strings.ToLower(bodyStr), "reasoning") && !c.noReasoning.Load():
			c.noReasoning.Store(true)
		case status == http.StatusTooManyRequests:
			// Kuota dihitung per project key per model: istirahatkan kombinasi ini, langsung coba yang lain.
			rateLimits++
			lastErr = ErrMOPRateLimited
			slog.Warn("mop_translate_rate_limited", slog.String("model", model), slog.Int("key", route.key+1))
			c.rest(route, rateLimitCooldown(bodyStr, rateLimits))
		case status == http.StatusUnauthorized || status == http.StatusForbidden:
			lastErr = fmt.Errorf("AI API error (%d): %.200s", status, bodyStr)
			failures++
			c.rest(route, mopCooldownKeyRejected)
		case status >= 500:
			lastErr = fmt.Errorf("AI API error (%d): %.200s", status, bodyStr)
			failures++
			c.rest(route, mopCooldownServerBusy)
		default:
			return "", fmt.Errorf("AI API error (%d): %.300s", status, bodyStr)
		}
	}

	if lastErr == nil {
		lastErr = ctx.Err()
	}
	return "", lastErr
}
