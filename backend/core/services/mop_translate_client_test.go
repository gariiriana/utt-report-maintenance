package services

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeGemini menjawab sesuai fungsi respond(model, key) dan mencatat setiap panggilan.
type fakeGemini struct {
	mu      sync.Mutex
	calls   []string // "model|key"
	respond func(model, key string, call int) (int, string)
}

func (f *fakeGemini) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Model string `json:"model"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	key := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	f.mu.Lock()
	f.calls = append(f.calls, req.Model+"|"+key)
	call := len(f.calls)
	f.mu.Unlock()

	status, body := f.respond(req.Model, key, call)
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

func (f *fakeGemini) count(model, key string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, c := range f.calls {
		if c == model+"|"+key {
			n++
		}
	}
	return n
}

const (
	okReply       = `{"choices":[{"message":{"content":"[0] Pastikan PTW telah disetujui"}}]}`
	perMinute429  = `{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"},{"retryDelay":"40s"}]}}`
	perDay429     = `{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"},{"retryDelay":"20s"}]}}`
	shortDelay429 = `{"error":{"code":429,"details":[{"retryDelay":"1s"}]}}`
)

func newTestMOPClient(t *testing.T, fake *fakeGemini, keys, models []string) *mopChatClient {
	t.Helper()
	srv := httptest.NewServer(fake)
	t.Cleanup(srv.Close)
	return &mopChatClient{
		baseURL:    srv.URL,
		apiKeys:    keys,
		models:     models,
		httpClient: srv.Client(),
		cooldown:   make(map[mopRoute]time.Time),
	}
}

func completeWithin(t *testing.T, c *mopChatClient) (string, error, time.Duration) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
	defer cancel()
	began := time.Now()
	reply, err := c.Complete(ctx, "system", "user")
	return reply, err, time.Since(began)
}

func TestMOPChatClient_SwitchesKeyOnRateLimit(t *testing.T) {
	fake := &fakeGemini{respond: func(_, key string, _ int) (int, string) {
		if key == "k1" {
			return http.StatusTooManyRequests, perMinute429
		}
		return http.StatusOK, okReply
	}}
	c := newTestMOPClient(t, fake, []string{"k1", "k2", "k3", "k4"}, []string{"m1"})

	for i := 0; i < 6; i++ {
		reply, err, took := completeWithin(t, c)
		if err != nil || !strings.Contains(reply, "Pastikan") {
			t.Fatalf("call %d: reply=%q err=%v", i, reply, err)
		}
		if took > 2*time.Second {
			t.Fatalf("call %d waited %v; a rate-limited key must be replaced immediately", i, took)
		}
	}
	// Setelah kena 429, k1 diistirahatkan dan tidak dicoba lagi pada panggilan berikutnya.
	if n := fake.count("m1", "k1"); n != 1 {
		t.Fatalf("k1 was called %d times, want exactly 1", n)
	}
}

func TestMOPChatClient_FallsBackToNextModelWhenAllKeysLimited(t *testing.T) {
	fake := &fakeGemini{respond: func(model, _ string, _ int) (int, string) {
		if model == "m1" {
			return http.StatusTooManyRequests, perMinute429
		}
		return http.StatusOK, okReply
	}}
	c := newTestMOPClient(t, fake, []string{"k1", "k2"}, []string{"m1", "m2"})

	if _, err, took := completeWithin(t, c); err != nil || took > 2*time.Second {
		t.Fatalf("err=%v took=%v; expected an immediate fallback to m2", err, took)
	}
	if fake.count("m1", "k1") != 1 || fake.count("m1", "k2") != 1 || fake.count("m2", "k1")+fake.count("m2", "k2") != 1 {
		t.Fatalf("unexpected calls: %v", fake.calls)
	}
}

func TestMOPChatClient_SkipsUnavailableModel(t *testing.T) {
	fake := &fakeGemini{respond: func(model, _ string, _ int) (int, string) {
		if model == "m1" {
			return http.StatusNotFound, `{"error":{"message":"This model is no longer available to new users."}}`
		}
		return http.StatusOK, okReply
	}}
	c := newTestMOPClient(t, fake, []string{"k1"}, []string{"m1", "m2"})

	for i := 0; i < 3; i++ {
		if _, err, _ := completeWithin(t, c); err != nil {
			t.Fatalf("call %d: %v", i, err)
		}
	}
	if n := fake.count("m1", "k1"); n != 1 {
		t.Fatalf("unavailable model was called %d times, want 1", n)
	}
}

func TestMOPChatClient_AllLimitedFailsFastWhenWaitTooLong(t *testing.T) {
	fake := &fakeGemini{respond: func(_, _ string, _ int) (int, string) {
		return http.StatusTooManyRequests, perMinute429
	}}
	c := newTestMOPClient(t, fake, []string{"k1", "k2"}, []string{"m1", "m2"})

	_, err, took := completeWithin(t, c)
	if !errors.Is(err, ErrMOPRateLimited) {
		t.Fatalf("expected ErrMOPRateLimited, got %v", err)
	}
	if took > 2*time.Second || len(fake.calls) != 4 {
		t.Fatalf("took %v with %d calls; every key/model must be tried once, then give up", took, len(fake.calls))
	}
}

func TestMOPChatClient_WaitsForShortRateLimit(t *testing.T) {
	fake := &fakeGemini{respond: func(_, _ string, call int) (int, string) {
		if call <= 2 {
			return http.StatusTooManyRequests, shortDelay429
		}
		return http.StatusOK, okReply
	}}
	c := newTestMOPClient(t, fake, []string{"k1", "k2"}, []string{"m1"})

	_, err, took := completeWithin(t, c)
	if err != nil {
		t.Fatalf("expected success after the short retryDelay, got %v", err)
	}
	if took < time.Second {
		t.Fatalf("took %v; expected to wait for the retryDelay before retrying", took)
	}
}

func TestMOPChatClient_AbandonsHungModel(t *testing.T) {
	old := mopAttemptTimeout
	mopAttemptTimeout = 200 * time.Millisecond
	t.Cleanup(func() { mopAttemptTimeout = old })

	fake := &fakeGemini{respond: func(model, _ string, _ int) (int, string) {
		if model == "m1" {
			time.Sleep(time.Second) // lebih lama dari batas waktu per percobaan
		}
		return http.StatusOK, okReply
	}}
	c := newTestMOPClient(t, fake, []string{"k1", "k2"}, []string{"m1", "m2"})

	_, err, took := completeWithin(t, c)
	if err != nil {
		t.Fatalf("expected the fallback model to answer, got %v", err)
	}
	if took > 900*time.Millisecond {
		t.Fatalf("took %v; the hung call must be abandoned after the attempt timeout", took)
	}
	// Model yang menggantung diistirahatkan untuk semua key, jadi tidak dicoba lagi dengan key lain.
	if n := fake.count("m1", "k1") + fake.count("m1", "k2"); n != 1 {
		t.Fatalf("hung model was called %d times, want 1", n)
	}
}

func TestRateLimitCooldown_DailyQuota(t *testing.T) {
	if got := rateLimitCooldown(perDay429, 1); got != mopCooldownDailyQuota {
		t.Fatalf("daily quota cooldown = %v, want %v", got, mopCooldownDailyQuota)
	}
	if got := rateLimitCooldown(perMinute429, 1); got < 40*time.Second || got > 41*time.Second {
		t.Fatalf("per-minute cooldown = %v, want retryDelay (40s)", got)
	}
}
