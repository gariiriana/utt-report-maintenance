package controllers

import (
	"net/http"
	"strings"

	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
)

// VoiceController handles WebSocket connections for the AI Voice Agent.
type VoiceController struct {
	service services.IVoiceService
}

// NewVoiceController creates a new VoiceController.
func NewVoiceController(service services.IVoiceService) *VoiceController {
	return &VoiceController{service: service}
}

// HandleVoiceSession upgrades the HTTP connection to WebSocket and starts a voice session.
// The Firebase auth token must be provided as a query parameter (?token=xxx) since
// WebSocket upgrade requests cannot carry Authorization headers from the browser.
func (c *VoiceController) HandleVoiceSession(w http.ResponseWriter, r *http.Request) {
	// WebSocket connections don't support standard Authorization headers from browser JS.
	// The token is passed as a query parameter and verified here.
	// The Firebase auth middleware has already validated the token if it was in the header.
	// For WebSocket, we also check query param as fallback.
	
	userUID := middlewares.UIDFromContext(r.Context())
	userEmail := middlewares.EmailFromContext(r.Context())

	if userUID == "" {
		// Try query parameter token (WebSocket fallback)
		token := r.URL.Query().Get("token")
		if token == "" {
			helpers.SendError(w, "Unauthorized: missing auth token", http.StatusUnauthorized)
			return
		}
		// Token will be verified by the auth middleware chain
		// If we got here without a UID, the token wasn't verified
		helpers.SendError(w, "Unauthorized: invalid token", http.StatusUnauthorized)
		return
	}

	// Validate that request is a WebSocket upgrade
	if !isWebSocketUpgrade(r) {
		helpers.SendError(w, "Expected WebSocket upgrade request", http.StatusBadRequest)
		return
	}

	// Delegate to voice service
	c.service.HandleSession(w, r, userUID, userEmail)
}

// isWebSocketUpgrade checks if the request is a WebSocket upgrade.
func isWebSocketUpgrade(r *http.Request) bool {
	// Connection header may contain "keep-alive, Upgrade" in some browsers
	connHeader := strings.ToLower(r.Header.Get("Connection"))
	upgradeHeader := strings.ToLower(r.Header.Get("Upgrade"))
	return strings.Contains(connHeader, "upgrade") && upgradeHeader == "websocket"
}
