package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
)

type WAController struct{}

func NewWAController() *WAController {
	return &WAController{}
}

type WASendRequest struct {
	Token       string `json:"token"`
	TargetPhone string `json:"targetPhone"`
	TargetGroup string `json:"targetGroup,omitempty"`
	Message     string `json:"message"`
}

type FonntePayload struct {
	Target      string `json:"target"`
	Message     string `json:"message"`
	CountryCode string `json:"countryCode"`
}

// SendMessage meneruskan pengiriman pesan ke Fonnte API secara aman dari server-side tanpa CORS issue
func (c *WAController) SendMessage(w http.ResponseWriter, r *http.Request) {
	var req WASendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.SendError(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		helpers.SendError(w, "Fonnte API Token wajib diisi", http.StatusBadRequest)
		return
	}

	if req.TargetPhone == "" {
		helpers.SendError(w, "Nomor WhatsApp tujuan wajib diisi", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		req.Message = fmt.Sprintf("🔔 *[TEST CLOUD WA GATEWAY]*\n\nIntegrasi WhatsApp Cloud DwimitraSystem (Fonnte API) berhasil terhubung dan siap digunakan!\n\n_Waktu: %s WIB_", time.Now().Format("02/01/2006 15:04:05"))
	}

	target := req.TargetPhone
	if req.TargetGroup != "" {
		target = target + "," + req.TargetGroup
	}

	fonntePayload := FonntePayload{
		Target:      target,
		Message:     req.Message,
		CountryCode: "62",
	}

	bodyBytes, err := json.Marshal(fonntePayload)
	if err != nil {
		helpers.SendError(w, "Failed to encode Fonnte payload: "+err.Error(), http.StatusInternalServerError)
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://api.fonnte.com/send", bytes.NewBuffer(bodyBytes))
	if err != nil {
		helpers.SendError(w, "Failed to create Fonnte HTTP request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	httpReq.Header.Set("Authorization", req.Token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(httpReq)
	if err != nil {
		helpers.SendError(w, "Failed to connect to Fonnte API: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		helpers.SendError(w, "Failed to read Fonnte API response: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var resMap map[string]interface{}
	if err := json.Unmarshal(respBody, &resMap); err != nil {
		helpers.SendError(w, "Invalid response from Fonnte API: "+string(respBody), http.StatusBadGateway)
		return
	}

	if status, ok := resMap["status"].(bool); !ok || !status {
		reason, _ := resMap["reason"].(string)
		if reason == "" {
			reason, _ = resMap["message"].(string)
		}
		if reason == "" {
			reason = "Fonnte returned false status"
		}
		helpers.SendError(w, reason, http.StatusBadRequest)
		return
	}

	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Pesan WhatsApp berhasil dikirim",
		"data":    resMap,
	})
}
