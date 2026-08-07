// ============================================================================
// FILE: backend/core/services/voice_service.go
// Deskripsi: Layanan Agen Suara Pintar AI Voice Command (JARVIS / Assistant M/E).
//            Mengolah streaming audio mikrofon teknisi melalui koneksi WebSocket,
//            menjangkau Gemini Multimodal Audio Model, & mengeksekusi instruksi suara
//            seperti mengisi form otomatis atau navigasi aplikasi.
// ============================================================================

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/DwimitraSystem/backend/core/config"
	"github.com/gorilla/websocket"
)

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE SERVICE — AI Voice Agent Orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

// IVoiceService defines the contract for voice agent operations.
type IVoiceService interface {
	HandleSession(w http.ResponseWriter, r *http.Request, userID string, userEmail string)
}

// VoiceSession represents an active voice conversation.
type VoiceSession struct {
	ID          string
	UserID      string
	UserEmail   string
	Conn        *websocket.Conn
	History     []ConversationMessage
	AppState    map[string]interface{} // Current frontend state
	cancelTTS   context.CancelFunc     // For barge-in
	mu          sync.Mutex
	closed      bool
}

// ConversationMessage represents a single turn in conversation.
type ConversationMessage struct {
	Role    string `json:"role"`    // "user" or "model"
	Content string `json:"content"`
}

// WSMessage is the JSON envelope for WebSocket text messages.
type WSMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// WSTranscriptData is sent when user speech is transcribed.
type WSTranscriptData struct {
	Text    string `json:"text"`
	IsFinal bool   `json:"is_final"`
}

// WSResponseData is sent when AI responds.
type WSResponseData struct {
	Text string `json:"text"`
}

// WSFunctionCallData is sent when AI triggers a function call.
type WSFunctionCallData struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

// WSFunctionResultData is received when frontend reports function execution result.
type WSFunctionResultData struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Result  string `json:"result"`
}

// WSAppStateData is received when frontend sends current app state.
type WSAppStateData struct {
	CurrentPage  string                 `json:"current_page"`
	ActiveForm   map[string]interface{} `json:"active_form,omitempty"`
	OpenModals   []string               `json:"open_modals,omitempty"`
	SelectedData map[string]interface{} `json:"selected_data,omitempty"`
}

// WSErrorData is sent when an error occurs.
type WSErrorData struct {
	Message string `json:"message"`
}

// ─── GEMINI API TYPES ────────────────────────────────────────────────────────

// GeminiRequest is the request body for Gemini generateContent.
type GeminiRequest struct {
	Contents         []GeminiContent        `json:"contents"`
	SystemInstruction *GeminiContent        `json:"systemInstruction,omitempty"`
	Tools            []GeminiTool           `json:"tools,omitempty"`
	GenerationConfig *GeminiGenerationConfig `json:"generationConfig,omitempty"`
}

// GeminiContent represents a message in the conversation.
type GeminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []GeminiPart `json:"parts"`
}

// GeminiPart is a content part (text or function call/response).
type GeminiPart struct {
	Text             string                   `json:"text,omitempty"`
	FunctionCall     *GeminiFunctionCall      `json:"functionCall,omitempty"`
	FunctionResponse *GeminiFunctionResponse  `json:"functionResponse,omitempty"`
}

// GeminiFunctionCall is a function call from the model.
type GeminiFunctionCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

// GeminiFunctionResponse is the result of a function call.
type GeminiFunctionResponse struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

// GeminiTool declares available functions.
type GeminiTool struct {
	FunctionDeclarations []GeminiFunctionDeclaration `json:"functionDeclarations"`
}

// GeminiFunctionDeclaration describes a callable function.
type GeminiFunctionDeclaration struct {
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Parameters  *GeminiSchema      `json:"parameters,omitempty"`
}

// GeminiSchema describes function parameter schema.
type GeminiSchema struct {
	Type       string                    `json:"type"`
	Properties map[string]GeminiProperty `json:"properties,omitempty"`
	Required   []string                  `json:"required,omitempty"`
	Enum       []string                  `json:"enum,omitempty"`
}

// GeminiProperty describes a single parameter.
type GeminiProperty struct {
	Type        string   `json:"type"`
	Description string   `json:"description,omitempty"`
	Enum        []string `json:"enum,omitempty"`
}

// GeminiGenerationConfig controls generation parameters.
type GeminiGenerationConfig struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

// GeminiResponse is the response from Gemini API.
type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

// GeminiCandidate is a single response candidate.
type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

// ─── VOICE SERVICE IMPLEMENTATION ─────────────────────────────────────────────

type voiceService struct {
	geminiAPIKey    string
	geminiModel     string
	geminiBaseURL   string
	firestoreClient *firestore.Client
	upgrader        websocket.Upgrader
}

// NewVoiceService creates a new voice service.
func NewVoiceService(firestoreClient *firestore.Client) IVoiceService {
	apiKey := config.EnvString("GEMINI_API_KEY", "")
	if apiKey == "" {
		apiKey = config.EnvString("NVIDIA_NIM_API_KEY", "")
	}
	if apiKey == "" {
		multiKeys := config.EnvString("NVIDIA_NIM_API_KEYS", "")
		if multiKeys != "" {
			parts := strings.Split(multiKeys, ",")
			for _, p := range parts {
				if trimmed := strings.TrimSpace(p); trimmed != "" {
					apiKey = trimmed
					break
				}
			}
		}
	}

	model := config.EnvString("GEMINI_VOICE_MODEL", "gemini-2.0-flash-lite")
	baseURL := config.EnvString("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")

	slog.Info("Voice Service initialized",
		slog.String("model", model),
		slog.Bool("has_api_key", apiKey != ""),
	)

	return &voiceService{
		geminiAPIKey:    apiKey,
		geminiModel:     model,
		geminiBaseURL:   baseURL,
		firestoreClient: firestoreClient,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  16384,
			WriteBufferSize: 16384,
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}
				// Allow localhost and known production origins
				allowedOrigins := []string{
					"http://localhost",
					"https://utt-report-maintenance",
					"https://report-utt",
				}
				for _, allowed := range allowedOrigins {
					if strings.HasPrefix(origin, allowed) {
						return true
					}
				}
				return false
			},
		},
	}
}

// HandleSession upgrades HTTP to WebSocket and runs the voice session loop.
func (vs *voiceService) HandleSession(w http.ResponseWriter, r *http.Request, userID string, userEmail string) {
	if vs.geminiAPIKey == "" {
		http.Error(w, "Voice service not configured: GEMINI_API_KEY missing", http.StatusServiceUnavailable)
		return
	}

	conn, err := vs.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade failed", "error", err.Error())
		return
	}

	session := &VoiceSession{
		ID:        fmt.Sprintf("voice_%s_%d", userID, time.Now().UnixMilli()),
		UserID:    userID,
		UserEmail: userEmail,
		Conn:      conn,
		History:   make([]ConversationMessage, 0),
		AppState:  make(map[string]interface{}),
	}

	slog.Info("Voice session started",
		slog.String("session_id", session.ID),
		slog.String("user_id", userID),
	)

	// Send session ready
	vs.sendJSON(session, "session_ready", map[string]string{
		"session_id": session.ID,
	})

	// Run the main session loop
	vs.sessionLoop(session)

	slog.Info("Voice session ended",
		slog.String("session_id", session.ID),
	)
}

// sessionLoop handles incoming WebSocket messages.
func (vs *voiceService) sessionLoop(session *VoiceSession) {
	defer func() {
		session.mu.Lock()
		session.closed = true
		session.mu.Unlock()
		session.Conn.Close()
	}()

	// Set read deadline and pong handler for keepalive
	session.Conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
	session.Conn.SetPongHandler(func(string) error {
		session.Conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
		return nil
	})

	// Start ping ticker
	go vs.pingLoop(session)

	for {
		messageType, message, err := session.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Warn("WebSocket read error", "session_id", session.ID, "error", err.Error())
			}
			return
		}

		// Only handle text messages (JSON)
		if messageType != websocket.TextMessage {
			continue
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			slog.Warn("Invalid WebSocket message", "session_id", session.ID, "error", err.Error())
			continue
		}

		switch msg.Type {
		case "user_transcript":
			vs.handleUserTranscript(session, msg.Data)
		case "barge_in":
			vs.handleBargeIn(session)
		case "app_state":
			vs.handleAppState(session, msg.Data)
		case "function_result":
			// Function results are handled inline during conversation
			slog.Info("Function result received", "session_id", session.ID)
		case "end_session":
			slog.Info("Client requested session end", "session_id", session.ID)
			return
		default:
			slog.Warn("Unknown message type", "session_id", session.ID, "type", msg.Type)
		}
	}
}

// pingLoop sends periodic pings to keep the WebSocket alive.
func (vs *voiceService) pingLoop(session *VoiceSession) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		session.mu.Lock()
		if session.closed {
			session.mu.Unlock()
			return
		}
		err := session.Conn.WriteMessage(websocket.PingMessage, nil)
		session.mu.Unlock()
		if err != nil {
			return
		}
	}
}

// handleUserTranscript processes final user speech transcript.
func (vs *voiceService) handleUserTranscript(session *VoiceSession, data json.RawMessage) {
	var transcript WSTranscriptData
	if err := json.Unmarshal(data, &transcript); err != nil {
		slog.Error("Failed to parse transcript", "error", err.Error())
		return
	}

	if !transcript.IsFinal || strings.TrimSpace(transcript.Text) == "" {
		return
	}

	userText := strings.TrimSpace(transcript.Text)
	slog.Info("User transcript received",
		slog.String("session_id", session.ID),
		slog.String("text", userText),
	)

	// Add to conversation history
	session.mu.Lock()
	session.History = append(session.History, ConversationMessage{
		Role:    "user",
		Content: userText,
	})
	session.mu.Unlock()

	// Signal AI is thinking
	vs.sendJSON(session, "ai_thinking", nil)

	// Call Gemini with function calling
	vs.processWithGemini(session, userText)
}

// handleBargeIn cancels ongoing TTS playback.
func (vs *voiceService) handleBargeIn(session *VoiceSession) {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.cancelTTS != nil {
		session.cancelTTS()
		session.cancelTTS = nil
		slog.Info("Barge-in: TTS cancelled", "session_id", session.ID)
	}
}

// handleAppState updates the session's knowledge of frontend state.
func (vs *voiceService) handleAppState(session *VoiceSession, data json.RawMessage) {
	var appState WSAppStateData
	if err := json.Unmarshal(data, &appState); err != nil {
		slog.Error("Failed to parse app state", "error", err.Error())
		return
	}

	session.mu.Lock()
	session.AppState["current_page"] = appState.CurrentPage
	session.AppState["active_form"] = appState.ActiveForm
	session.AppState["open_modals"] = appState.OpenModals
	session.AppState["selected_data"] = appState.SelectedData
	session.mu.Unlock()

	slog.Info("App state updated",
		slog.String("session_id", session.ID),
		slog.String("current_page", appState.CurrentPage),
	)
}

// processWithGemini sends the conversation to Gemini and handles the response.
func (vs *voiceService) processWithGemini(session *VoiceSession, userText string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	slog.Debug("Processing with Gemini", "session_id", session.ID, "prompt_len", len(userText))

	// Store cancel for barge-in
	session.mu.Lock()
	session.cancelTTS = cancel
	session.mu.Unlock()

	// Build Gemini request
	request := vs.buildGeminiRequest(session)

	// Call Gemini API
	response, err := vs.callGeminiAPI(ctx, request)
	if err != nil {
		slog.Error("Gemini API call failed",
			slog.String("session_id", session.ID),
			slog.String("error", err.Error()),
		)
		vs.sendJSON(session, "error", WSErrorData{
			Message: "Maaf, terjadi kesalahan. Silakan coba lagi.",
		})
		return
	}

	// Process the response
	vs.processGeminiResponse(session, response, ctx)
}

// buildGeminiRequest constructs the full Gemini API request.
func (vs *voiceService) buildGeminiRequest(session *VoiceSession) *GeminiRequest {
	session.mu.Lock()
	defer session.mu.Unlock()

	// Build app context string
	appCtxJSON, _ := json.Marshal(session.AppState)

	systemPrompt := fmt.Sprintf(`Kamu adalah AI Voice Agent operator untuk aplikasi UTT Report Maintenance data center.
Kamu BUKAN chatbot biasa — kamu adalah operator yang mengontrol seluruh fitur aplikasi melalui perintah suara.

CREATOR: Tuan Gari Iriana. Seluruh sistem ini dibangun oleh Tuan Gari Iriana.

ATURAN UTAMA:
1. Selalu jawab dalam Bahasa Indonesia natural, ramah, dan RINGKAS (1-3 kalimat) karena ini percakapan suara langsung.
2. Bicara santai, bersahabat, dan interaktif seperti manusia asli (BUKAN robot kaku). Gunakan interjeksi/kata sambung alami secara wajar seperti: "Mmm...", "Hmm, oke...", "Sip, bentar ya...", "Oalah oke...", "Oke, lalu?".
3. JANGAN pernah mengarang data — selalu gunakan function calling untuk mengambil/memanipulasi data.
4. Jika informasi kurang, tanyakan balik dengan singkat dan natural.
5. Selalu gunakan function calling untuk SETIAP aksi yang berhubungan dengan aplikasi.
6. Ingat konteks percakapan sebelumnya.
7. Jika user bertanya tentang topik di luar maintenance data center dan operasional aplikasi, tolak dengan sopan dan santai.
8. JANGAN gunakan formatting markdown (**, #, -, dll). Jawab dalam kalimat biasa yang enak dibaca dan diucapkan.

KONTEKS APLIKASI SAAT INI:
%s

FITUR YANG BISA KAMU KONTROL:
- Navigasi halaman (Service Report, ATS Report, Dashboard, Maintenance Progress, Findings, dll)
- Buat laporan baru (Service Report, ATS Report)
- Cari dan filter laporan
- Export PDF
- Isi form berdasarkan percakapan
- Edit laporan
- Hapus laporan
- Download laporan
- Refresh data
- Buka/tutup modal
- Klik tombol
- Filter berdasarkan customer/tanggal/status
- Simpan perubahan
- Tampilkan histori

USER INFO: %s (%s)`, string(appCtxJSON), session.UserEmail, session.UserID)

	// Build contents from conversation history
	contents := make([]GeminiContent, 0, len(session.History))
	for _, msg := range session.History {
		contents = append(contents, GeminiContent{
			Role: msg.Role,
			Parts: []GeminiPart{
				{Text: msg.Content},
			},
		})
	}

	return &GeminiRequest{
		SystemInstruction: &GeminiContent{
			Parts: []GeminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
		Tools: []GeminiTool{
			{FunctionDeclarations: GetVoiceFunctionDeclarations()},
		},
		GenerationConfig: &GeminiGenerationConfig{
			Temperature:     0.7,
			MaxOutputTokens: 512,
		},
	}
}

// callGeminiAPI makes the HTTP request to Gemini API.
func (vs *voiceService) callGeminiAPI(ctx context.Context, request *GeminiRequest) (*GeminiResponse, error) {
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s",
		vs.geminiBaseURL, vs.geminiModel, vs.geminiAPIKey)

	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error %d: %s", resp.StatusCode, string(respBody))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w (body: %.500s)", err, string(respBody))
	}

	return &geminiResp, nil
}

// processGeminiResponse handles the response — text reply and/or function calls.
func (vs *voiceService) processGeminiResponse(session *VoiceSession, response *GeminiResponse, ctx context.Context) {
	if len(response.Candidates) == 0 {
		vs.sendJSON(session, "error", WSErrorData{Message: "AI tidak memberikan respons."})
		return
	}

	candidate := response.Candidates[0]

	for _, part := range candidate.Content.Parts {
		// Check if context was cancelled (barge-in)
		select {
		case <-ctx.Done():
			slog.Info("Response processing cancelled (barge-in)", "session_id", session.ID)
			return
		default:
		}

		if part.FunctionCall != nil {
			// Handle function call
			vs.handleFunctionCall(session, part.FunctionCall, ctx)
		} else if part.Text != "" {
			// Send text response
			responseText := strings.TrimSpace(part.Text)
			if responseText != "" {
				// Add to history
				session.mu.Lock()
				session.History = append(session.History, ConversationMessage{
					Role:    "model",
					Content: responseText,
				})
				session.mu.Unlock()

				vs.sendJSON(session, "ai_response", WSResponseData{
					Text: responseText,
				})

				// Signal TTS should start
				vs.sendJSON(session, "tts_start", nil)
			}
		}
	}
}

// handleFunctionCall processes a function call from Gemini.
func (vs *voiceService) handleFunctionCall(session *VoiceSession, fnCall *GeminiFunctionCall, ctx context.Context) {
	slog.Info("Function call from Gemini",
		slog.String("session_id", session.ID),
		slog.String("function", fnCall.Name),
	)

	// Send function call to frontend for execution
	vs.sendJSON(session, "function_call", WSFunctionCallData{
		Name: fnCall.Name,
		Args: fnCall.Args,
	})

	// Wait for frontend to report the function result
	resultCh := make(chan WSFunctionResultData, 1)

	// Start a goroutine that reads the next function_result message
	go func() {
		for {
			session.Conn.SetReadDeadline(time.Now().Add(15 * time.Second))
			_, message, err := session.Conn.ReadMessage()
			if err != nil {
				resultCh <- WSFunctionResultData{
					Name:    fnCall.Name,
					Success: false,
					Result:  "Timeout menunggu hasil eksekusi",
				}
				return
			}

			var msg WSMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "function_result":
				var result WSFunctionResultData
				if err := json.Unmarshal(msg.Data, &result); err != nil {
					continue
				}
				resultCh <- result
				return
			case "barge_in":
				vs.handleBargeIn(session)
			case "app_state":
				vs.handleAppState(session, msg.Data)
			}
		}
	}()

	// Wait for result or timeout
	select {
	case result := <-resultCh:
		// Reset read deadline
		session.Conn.SetReadDeadline(time.Now().Add(5 * time.Minute))

		// Send function result back to Gemini for final answer
		vs.sendFunctionResultToGemini(session, fnCall, result, ctx)

	case <-ctx.Done():
		slog.Info("Function call cancelled (barge-in)", "session_id", session.ID)
		return
	}
}

// sendFunctionResultToGemini sends the function execution result back to Gemini.
func (vs *voiceService) sendFunctionResultToGemini(session *VoiceSession, fnCall *GeminiFunctionCall, result WSFunctionResultData, ctx context.Context) {
	session.mu.Lock()
	// Add function call and result to history
	session.History = append(session.History, ConversationMessage{
		Role:    "model",
		Content: fmt.Sprintf("[Function Call: %s]", fnCall.Name),
	})
	session.mu.Unlock()

	// Build a new request with the function result
	request := vs.buildGeminiRequest(session)

	// Add function call and response to the contents
	request.Contents = append(request.Contents,
		GeminiContent{
			Role: "model",
			Parts: []GeminiPart{
				{FunctionCall: fnCall},
			},
		},
		GeminiContent{
			Role: "user",
			Parts: []GeminiPart{
				{FunctionResponse: &GeminiFunctionResponse{
					Name: fnCall.Name,
					Response: map[string]interface{}{
						"success": result.Success,
						"result":  result.Result,
					},
				}},
			},
		},
	)

	// Remove the last history entry we just added (it was for tracking)
	session.mu.Lock()
	if len(session.History) > 0 {
		session.History = session.History[:len(session.History)-1]
	}
	session.mu.Unlock()

	response, err := vs.callGeminiAPI(ctx, request)
	if err != nil {
		slog.Error("Gemini API call failed after function result",
			slog.String("session_id", session.ID),
			slog.String("error", err.Error()),
		)
		vs.sendJSON(session, "ai_response", WSResponseData{
			Text: "Aksi berhasil dilakukan.",
		})
		return
	}

	vs.processGeminiResponse(session, response, ctx)
}

// sendJSON sends a JSON message over WebSocket.
func (vs *voiceService) sendJSON(session *VoiceSession, msgType string, data interface{}) {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.closed {
		return
	}

	var dataBytes json.RawMessage
	if data != nil {
		b, err := json.Marshal(data)
		if err != nil {
			slog.Error("Failed to marshal WS data", "error", err.Error())
			return
		}
		dataBytes = b
	}

	msg := WSMessage{
		Type: msgType,
		Data: dataBytes,
	}

	if err := session.Conn.WriteJSON(msg); err != nil {
		slog.Error("Failed to send WS message",
			slog.String("session_id", session.ID),
			slog.String("type", msgType),
			slog.String("error", err.Error()),
		)
	}
}
