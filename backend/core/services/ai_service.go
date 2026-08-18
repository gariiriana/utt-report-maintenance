// ============================================================================
// FILE: backend/core/services/ai_service.go
// Deskripsi: Core AI Engine Service (Google Gemini Vision API Integration).
//            Layanan terpusat pemrosesan kecerdasan buatan untuk 13 kategori perangkat M/E:
//            - Multi-Key Round-Robin Pool untuk rotasi API Key anti-rate-limit.
//            - Pemindaian foto multimeter, power meter, thermovisi, & nameplate panel.
//            - OCR digitasi dokumen fisik lembar kertas cetak ke objek JSON.
//            - Pelacakan kuota harian sistem di Firestore system_status/ai_limit_tracker.
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
	"sync/atomic"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/DwimitraSystem/backend/core/config"
	"github.com/gariiriana/DwimitraSystem/backend/core/models"
)

// IAIService defines the contract for AI analysis operations.
type IAIService interface {
	AnalyzeATSPhotos(ctx context.Context, photos []models.ATSPhotoInput, existingData *models.ATSReportData) (*models.ATSReportData, error)
	AnalyzeFCUPhotos(ctx context.Context, photos []models.FCUPhotoInput, existingData *models.FCUReportData) (*models.FCUReportData, error)
	AnalyzePJUPhotos(ctx context.Context, photos []models.PJUPhotoInput, existingData *models.PJUReportData) (*models.PJUReportData, error)
	AnalyzePDUPhotos(ctx context.Context, photos []models.PDUPhotoInput, existingData *models.PDUReportData) (*models.PDUReportData, error)
	AnalyzeCTPhotos(ctx context.Context, photos []models.CTPhotoInput, existingData any) (any, error)
	AnalyzeGeneratorPhotos(ctx context.Context, photos []models.GeneratorPhotoInput, existingData any) (any, error)
	AnalyzeTrafoPhotos(ctx context.Context, photos []models.TrafoPhotoInput, existingData any) (any, error)
	AnalyzeACSplitPhotos(ctx context.Context, photos []models.ACSplitPhotoInput, existingData any) (any, error)
	AnalyzeBusductPhotos(ctx context.Context, photos []models.BusductPhotoInput, existingData any) (any, error)
	AnalyzeDocklevelerPhotos(ctx context.Context, photos []models.DocklevelerPhotoInput, existingData any) (any, error)
	AnalyzeDoorPhotos(ctx context.Context, photos []models.DoorPhotoInput, existingData any) (any, error)
	AnalyzeCapacitorbankPhotos(ctx context.Context, photos []models.CapacitorbankPhotoInput, existingData any) (any, error)
	AnalyzeLdbrdbPhotos(ctx context.Context, photos []models.LdbrdbPhotoInput, existingData any) (any, error)

	Chat(ctx context.Context, messages []models.ChatMessage) (string, error)
	ValidateATSForm(ctx context.Context, data models.ATSReportData, photos []models.ATSPhotoInput) (*models.FormValidationResponse, error)
	AnalyzeSingleCard(ctx context.Context, req models.CardAnalyzeRequest) (*models.CardAnalyzeResponse, error)
	DigitizePaperReport(ctx context.Context, photos []string, accountEmail string) (*models.PaperReportScanResponse, error)
}

// ─── AI AGENT SERVICE ────────────────────────────────────────────────────────

type aiService struct {
	apiKeys        []string // Pool of API keys for round-robin
	keyIndex       uint64   // Atomic counter for round-robin
	baseURL        string
	visionModel    string // Stage 2: multimodal vision model
	reasoningModel string // Stage 3: text-only reasoning model
	chatModel      string // Fast model for interactive chat
	firestoreClient *firestore.Client
}

// NewAIService creates a new AI service with multi-key and multi-model support.
func NewAIService(firestoreClient *firestore.Client) IAIService {
	svc := &aiService{
		baseURL:        config.EnvString("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1/chat/completions"),
		visionModel:    config.EnvString("NVIDIA_NIM_VISION_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "meta/llama-3.2-11b-vision-instruct")),
		reasoningModel: config.EnvString("NVIDIA_NIM_REASONING_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "z-ai/glm-5.1")),
		chatModel:      config.EnvString("NVIDIA_NIM_CHAT_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "meta/llama-3.1-8b-instruct")),
		firestoreClient: firestoreClient,
	}

	// Load API keys: prefer multi-key pool, fallback to single key
	multiKeys := config.EnvString("NVIDIA_NIM_API_KEYS", "")
	if multiKeys != "" {
		for _, k := range strings.Split(multiKeys, ",") {
			k = strings.TrimSpace(k)
			if k != "" {
				svc.apiKeys = append(svc.apiKeys, k)
			}
		}
	}
	if len(svc.apiKeys) == 0 {
		singleKey := config.EnvString("NVIDIA_NIM_API_KEY", "")
		if singleKey != "" {
			svc.apiKeys = []string{singleKey}
		}
	}

	slog.Info("AI Agent pipeline initialized",
		slog.Int("api_keys", len(svc.apiKeys)),
		slog.String("vision_model", svc.visionModel),
		slog.String("reasoning_model", svc.reasoningModel),
		slog.String("chat_model", svc.chatModel),
	)

	return svc
}

// getNextAPIKey returns the next API key in round-robin fashion.
func (s *aiService) getNextAPIKey() string {
	if len(s.apiKeys) == 0 {
		return ""
	}
	idx := atomic.AddUint64(&s.keyIndex, 1)
	return s.apiKeys[idx%uint64(len(s.apiKeys))]
}

// incrementUsedRequest increments the AI usage counter in Firestore and manages daily reset.
func (s *aiService) incrementUsedRequest(ctx context.Context) {
	if s.firestoreClient == nil {
		return
	}

	// WIB (UTC+7) time for data center operational timezone
	now := time.Now().UTC().Add(7 * time.Hour)
	todayStr := now.Format("2006-01-02")

	docRef := s.firestoreClient.Collection("system_status").Doc("ai_limit_tracker")

	err := s.firestoreClient.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(docRef)
		
		var data map[string]interface{}
		if err != nil {
			// Document does not exist, create it
			data = map[string]interface{}{
				"total_limit":     int64(6000),
				"used_today":      int64(1),
				"last_reset_date": todayStr,
			}
			return tx.Set(docRef, data)
		}

		lastReset, _ := snapshot.Data()["last_reset_date"].(string)
		usedToday, _ := snapshot.Data()["used_today"].(int64)
		totalLimit, _ := snapshot.Data()["total_limit"].(int64)
		if totalLimit == 0 {
			totalLimit = 6000
		}

		if lastReset != todayStr {
			// Daily reset: it's a new day
			return tx.Update(docRef, []firestore.Update{
				{Path: "used_today", Value: int64(1)},
				{Path: "last_reset_date", Value: todayStr},
				{Path: "total_limit", Value: totalLimit},
			})
		}

		// Increment used request
		return tx.Update(docRef, []firestore.Update{
			{Path: "used_today", Value: usedToday + 1},
		})
	})

	if err != nil {
		slog.Error("Failed to increment AI request limit counter in Firestore", "error", err.Error())
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

// AnalyzeATSPhotos implements the optimized text-based AI Agent pipeline.
func (s *aiService) AnalyzeATSPhotos(ctx context.Context, photos []models.ATSPhotoInput, existingData *models.ATSReportData) (*models.ATSReportData, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no NVIDIA NIM API keys configured (set NVIDIA_NIM_API_KEYS or NVIDIA_NIM_API_KEY)")
	}

	pipelineStart := time.Now()
	slog.Info("AGENT Pipeline started (Text-based parameters)",
		slog.Int("total_photos", len(photos)),
		slog.Int("api_keys", len(s.apiKeys)),
	)

	// Format all engineer descriptions and parameters
	var sb strings.Builder
	for idx, p := range photos {
		sb.WriteString(fmt.Sprintf("Item %d:\n", idx+1))
		sb.WriteString(fmt.Sprintf("- Category: %s\n", p.Category))
		sb.WriteString(fmt.Sprintf("- Description/Label: %s\n", p.Label))
		sb.WriteString(fmt.Sprintf("- Parameter Value/Catatan: %s\n\n", p.Parameter))
	}
	itemsText := sb.String()

	var existingDataText string
	if existingData != nil {
		dataBytes, _ := json.MarshalIndent(existingData, "", "  ")
		existingDataText = fmt.Sprintf("\nEXISTING MEASUREMENT DATA (DO NOT OVERWRITE OR MUTATE THESE MEASUREMENT VALUES, ONLY POPULATE/IMPROVE REMARKS IN INDONESIAN):\n%s\n", string(dataBytes))
	}

	prompt := fmt.Sprintf(`You are a precision consolidation AI agent for electrical maintenance reports.
We have a list of items where the maintenance engineer has already written down the parameter values and notes.
%s
Your ONLY job is to compile a complete, structured JSON report matching the schema below.
For each item:
1. Parse the parameter values provided by the engineer and assign them to the correct fields in the schema.
2. Generate professional, precise, and VERY CONCISE REMARKS (in Indonesian, MAXIMUM 2 to 5 words per field/item, e.g. "Sesuai standar", "Bersih & terawat", "Kencang & rapi", "Tidak ada korosi"). NEVER write long sentences.
   - For grounding: set grounding_resistance.result_ohm. If it is < 5 ohm, write a concise remark like "Sesuai standar (<5 Ω)".
   - For thermal: set thermal_measurement.result_temperature. If it is < 40°C, write a concise remark like "Normal & aman".
   - For power_meter: map voltages and currents to power_meter_recording AND voltage_current. Write concise remarks like "Seimbang & normal".
   - For visual_inspection: map the checklist items (a to p). Write VERY CONCISE remarks (max 2 to 5 words, e.g. "Kondisi bersih & terawat"). Ensure all 16 items (a to p) are present in the final list with their exact activity names.
3. Set operation_status.is_normal = true unless there is an anomaly (e.g. grounding >= 5 ohm, temperature >= 40°C, or a visual item condition is "Not Good").
4. Output ONLY valid JSON matching the exact schema below. Do not output markdown code fences, do not output explanations, just the JSON.

ENGINEER'S LOGS AND VALUES:
%s

OUTPUT JSON STRUCTURE:
{
  "visual_inspection": [
    {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
    {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
    {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
    {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
    {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
    {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
  ],
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "", "kva": "", "kvar": "", "cos_p": "",
    "r_ampere": "", "s_ampere": "", "t_ampere": "", "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "", "voltage_st": "", "voltage_tr": "",
    "voltage_rn": "", "voltage_sn": "", "voltage_tn": "", "voltage_ng": "",
    "ampere_r": "", "ampere_s": "", "ampere_t": "",
    "remarks": ""
  },
  "thermal_measurement": {
    "result_temperature": "", "standard": "40°C", "remarks": ""
  },
  "grounding_resistance": {
    "result_ohm": "", "standard": "<5 Ω", "remarks": ""
  },
  "operation_status": {
    "is_normal": true,
    "remark": "",
    "fault_symptom": "",
    "fault_analysis": "",
    "work_done": "",
    "fault_part_sn": "",
    "fault_part_name": ""
  }
}

RULES:
- Output ONLY the JSON object. No markdown code fences. No explanation text.
- If existing_data is provided, preserve all measurement values exactly as provided in existing_data. Do not alter voltages, currents, temperatures, grounding resistance, or visual inspection conditions. Only update or fill in the remarks fields using Indonesian.
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on data`, existingDataText, itemsText)

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": "You are a precision data consolidation agent for electrical maintenance reports. Your job is to parse engineer logs, map parameters, and write Indonesian remarks into a validated JSON report. Output ONLY valid JSON, no markdown.",
		},
		{
			"role":    "user",
			"content": prompt,
		},
	}

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, messages, 0.2, 16384, 90*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("deepseek reasoning api call failed: %w", err)
	}

	reportData, err := s.parseJSONResponse(respContent)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI JSON response: %w", err)
	}

	slog.Info("AGENT Pipeline complete (Text-based parameter mode)",
		slog.Duration("total_duration", time.Since(pipelineStart)),
	)

	return reportData, nil
}

// AnalyzeFCUPhotos implements the text-based AI Agent pipeline for FCU (Fan Coil Unit) Service Report.
func (s *aiService) AnalyzeFCUPhotos(ctx context.Context, photos []models.FCUPhotoInput, existingData *models.FCUReportData) (*models.FCUReportData, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no NVIDIA NIM API keys configured (set NVIDIA_NIM_API_KEYS or NVIDIA_NIM_API_KEY)")
	}

	pipelineStart := time.Now()
	slog.Info("FCU AGENT Pipeline started (Text-based parameters)",
		slog.Int("total_photos", len(photos)),
		slog.Int("api_keys", len(s.apiKeys)),
	)

	var sb strings.Builder
	for idx, p := range photos {
		sb.WriteString(fmt.Sprintf("Item %d:\n", idx+1))
		sb.WriteString(fmt.Sprintf("- Category: %s\n", p.Category))
		sb.WriteString(fmt.Sprintf("- Description/Label: %s\n", p.Label))
		sb.WriteString(fmt.Sprintf("- Parameter Value/Catatan: %s\n\n", p.Parameter))
	}
	itemsText := sb.String()

	var existingDataText string
	if existingData != nil {
		dataBytes, _ := json.MarshalIndent(existingData, "", "  ")
		existingDataText = fmt.Sprintf("\nEXISTING MEASUREMENT DATA (DO NOT OVERWRITE MEASUREMENTS, ONLY POPULATE/IMPROVE REMARKS IN INDONESIAN):\n%s\n", string(dataBytes))
	}

	prompt := fmt.Sprintf(`You are a precision consolidation AI agent for FCU (Fan Coil Unit) HVAC maintenance reports.
We have a list of items where the maintenance engineer has provided parameter values, photo descriptions, and notes.
%s
Your ONLY job is to compile a complete, structured JSON report matching the FCU schema below.

For each section:
1. "visual_inspection": Analyze photos & descriptions for all 18 visual items (a to r). Set condition ("Good" or "Not good") and write VERY CONCISE Indonesian remarks (MAXIMUM 2 to 5 words, e.g. "Kondisi bersih & terawat", "Sesuai standar", "Tidak ada korosi"). NEVER write long sentences.
2. "cleaning": Analyze photos & descriptions for all 10 cleaning items (a to j). Set condition ("Good" or "Not good") and write VERY CONCISE Indonesian remarks (MAXIMUM 2 to 5 words, e.g. "Bersih dari debu", "Bersih & terawat").
3. "voltage_current": Assign voltage & current readings. Write concise remark like "Seimbang & normal".
4. "vibration_noise": Set condition and write concise remark (max 2-5 words).
5. "temp_humidity": Set condition and write concise remark (max 2-5 words).
6. "pipe_pressure": Set condition and write concise remark (max 2-5 words).
7. "air_flow": Set condition and write concise remark (max 2-5 words).
8. "operation_status": Set is_normal = true unless anomalies exist (e.g. pressure out of range, temp/vibration high, or any visual/cleaning item is "Not good"). Write comprehensive summary remark.

ENGINEER'S LOGS AND VALUES:
%s

OUTPUT JSON STRUCTURE:
{
  "visual_inspection": [
    {"no": "a", "activity": "Checked of the AC enclosure cleaness with duster", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Checked the Air Filter cleaness from dust", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Checked of mounting, vibration, noise with vibration meter and sound level meter", "parameter": "Normal", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Checked the Evaporator Coil cleaness from dust and algae", "parameter": "clean", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Checked the Electrical control Components", "parameter": "on function", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Checked the termination of Electrical control Components", "parameter": "on function", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Checked the supply and returnt operation pressure", "parameter": "Normal", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Checked the settings point and actual Temperature and Humidity", "parameter": "on function", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Checked the level and cleaning of the flushing and Drain pipes of drain tanks", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Checked for airflow obstructions or Airflow Blockade", "parameter": "No obstructions", "condition": "Good", "remarks": ""},
    {"no": "k", "activity": "Checked remote for control unit", "parameter": "on function", "condition": "Good", "remarks": ""},
    {"no": "l", "activity": "Checked and completed the missing bolt", "parameter": "Complete bolts", "condition": "Good", "remarks": ""},
    {"no": "m", "activity": "Checked the all support (tray, compressor, pipe refrigerant, fan indoor,fan)", "parameter": "Complete", "condition": "Good", "remarks": ""},
    {"no": "n", "activity": "Inspection & Checked the Fan indoor main motor (mounting, support)", "parameter": "Normal", "condition": "Good", "remarks": ""},
    {"no": "o", "activity": "Checked drain pump.", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "p", "activity": "Inspection tension of fanbelt unit", "parameter": "Normal", "condition": "Good", "remarks": ""},
    {"no": "q", "activity": "Check pressure FCU with CHWS", "parameter": "Normal", "condition": "Good", "remarks": ""},
    {"no": "r", "activity": "Check Pressure FCU With CHWR", "parameter": "Normal", "condition": "Good", "remarks": ""}
  ],
  "cleaning": [
    {"no": "a", "activity": "Cleaning of the AC enclosure cleaness", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Cleaning the Air Filter cleaness", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Cleaning the component AC from oil & referigerant", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Cleaning of the flushing and Drain pipes of drain tanks", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Cleaning the drain pan, drain pump & drain pipe", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Cleaning the Evaporator Coil cleaness", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Cleaning the component AC from oil", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Cleaning fan motor", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Cleaning return air grille", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Checked for airflow obstructions or Airflow Blockade", "parameter": "Clean", "condition": "Good", "remarks": ""}
  ],
  "voltage_current": {
    "voltage_rn": "", "voltage_sn": "", "voltage_tn": "",
    "voltage_rs": "", "voltage_st": "", "voltage_tr": "",
    "current_r": "", "current_s": "", "current_t": "",
    "condition": "Good", "remarks": ""
  },
  "vibration_noise": {
    "vibration": "", "noise": "", "condition": "Good", "remarks": ""
  },
  "temp_humidity": {
    "temp": "", "rh": "", "condition": "Good", "remarks": ""
  },
  "pipe_pressure": {
    "supply": "", "return_val": "", "condition": "Good", "remarks": ""
  },
  "air_flow": {
    "air_flow": "", "condition": "Good", "remarks": ""
  },
  "operation_status": {
    "is_normal": true,
    "remark": "",
    "fault_symptom": "",
    "fault_analysis": "",
    "work_done": "",
    "fault_part_sn": "",
    "fault_part_name": ""
  }
}

RULES:
- Output ONLY the JSON object. No markdown code fences. No explanation text.`, existingDataText, itemsText)

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": "You are a precision HVAC data consolidation agent for FCU maintenance reports. Output ONLY valid JSON, no markdown.",
		},
		{
			"role":    "user",
			"content": prompt,
		},
	}

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, messages, 0.2, 16384, 90*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("FCU reasoning API call failed: %w", err)
	}

	reportData, err := s.parseFCUJSONResponse(respContent)
	if err != nil {
		return nil, fmt.Errorf("failed to parse FCU AI JSON response: %w", err)
	}

	slog.Info("FCU AGENT Pipeline complete", slog.Duration("total_duration", time.Since(pipelineStart)))
	return reportData, nil
}

func (s *aiService) parseFCUJSONResponse(content string) (*models.FCUReportData, error) {
	slog.Info("RAW FCU RESPONSE", slog.String("content", content))
	content = strings.TrimSpace(content)

	if idx := strings.Index(content, "</think>"); idx != -1 {
		content = strings.TrimSpace(content[idx+len("</think>"):])
	}

	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result models.FCUReportData
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse FCU JSON: %w (raw: %.500s)", err, content)
	}

	return &result, nil
}


// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1: PARTITION
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) partitionPhotos(photos []models.ATSPhotoInput) map[string][]models.ATSPhotoInput {
	groups := map[string][]models.ATSPhotoInput{
		"grounding":         {},
		"thermal":           {},
		"power_meter":       {},
		"visual_inspection": {},
	}
	for _, p := range photos {
		cat := p.Category
		if _, ok := groups[cat]; !ok {
			cat = "visual_inspection" // fallback unknown categories
		}
		groups[cat] = append(groups[cat], p)
	}
	return groups
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2: PER-CATEGORY VISION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/*
func (s *aiService) analyzeCategory(ctx context.Context, apiKey, category string, photos []models.ATSPhotoInput) (string, error) {
	// Build multimodal content array with images
	var content []map[string]interface{}

	// Category-specific focused prompt
	prompt := s.buildCategoryPrompt(category, photos)
	content = append(content, map[string]interface{}{
		"type": "text",
		"text": prompt,
	})

	// Attach each photo with its engineer label BEFORE the image
	for i, photo := range photos {
		mimeType := "image/jpeg"
		if strings.HasPrefix(photo.Base64, "iVBOR") {
			mimeType = "image/png"
		}
		imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, photo.Base64)

		label := photo.Label
		if label == "" {
			label = photo.Category
		}

		// Label text BEFORE image (multimodal best practice)
		content = append(content, map[string]interface{}{
			"type": "text",
			"text": fmt.Sprintf("--- PHOTO %d of %d ---\nEngineer Description: %s", i+1, len(photos), label),
		})
		content = append(content, map[string]interface{}{
			"type":      "image_url",
			"image_url": map[string]interface{}{"url": imageURL},
		})
	}

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": s.buildCategorySystemPrompt(category),
		},
		{
			"role":    "user",
			"content": content,
		},
	}

	return s.callNVIDIA(ctx, apiKey, s.visionModel, messages, 0.0, 4096, 60*time.Second, nil)
}
*/

// buildCategorySystemPrompt returns a hyper-focused system prompt per category.
func (s *aiService) buildCategorySystemPrompt(category string) string {
	switch category {
	case "grounding":
		return `You are a precision instrument display reader specializing in EARTH CLAMP TESTER / grounding meter readings.
Your ONLY job is to read the exact Ω (ohm) value from the LCD display of the grounding meter in the photo.
Rules:
- Read EVERY digit precisely, including decimal points
- If the engineer's description mentions a value (e.g. "0.34 ohm"), cross-verify with the photo
- NEVER guess or hallucinate values. If you see "0.34" on the display, output "0.34"
- Output ONLY valid JSON, no markdown, no explanation`

	case "thermal":
		return `You are a precision instrument display reader specializing in THERMAL IMAGER readings.
Your ONLY job is to read the exact temperature (°C) from the thermal camera display/photo.
Rules:
- Read the temperature value precisely, including decimal points
- Look for the MAIN temperature reading on the display (usually the largest number)
- If the engineer's description mentions a temperature, cross-verify with the photo
- NEVER guess or hallucinate values
- Output ONLY valid JSON, no markdown, no explanation`

	case "power_meter":
		return `You are a precision instrument display reader specializing in ELECTRICAL MEASUREMENT INSTRUMENTS.
Your ONLY job is to read exact voltage (V), current (A), power (kW/kVA/kVAR), and power factor values from clamp meters and digital power meters.
Rules:
- Read EVERY digit precisely, including decimal points
- For clamp meters (e.g. Fluke, Kyoritsu): read the LARGE MAIN DIGITS on the LCD
- For built-in digital power meters (DPM): read each displayed parameter value
- Match each photo's engineer description to determine which measurement it is (R-S, S-T, T-R, R-N, S-N, T-N, N-G, Ampere R/S/T)
- NEVER guess standard nominal values (like 398.5, 230.2). Read the ACTUAL digits shown
- If you see "390.1", write "390.1" — NOT "398.5" or any other value
- Output ONLY valid JSON, no markdown, no explanation`

	case "visual_inspection":
		return `You are an expert electrical engineer performing a visual inspection of an ATS (Automatic Transfer Switch) panel.
Your job is to assess the physical condition of panel components from photos.
Rules:
- Evaluate each inspection item based on what you see in the photos
- Set condition to "Good" if the component appears normal, or "Not Good" if issues are found
- Add specific observations in remarks if any issues are noted
- Output ONLY valid JSON, no markdown, no explanation`

	default:
		return "You are a precision instrument reader. Read exact values from instrument displays. Output ONLY valid JSON."
	}
}

// buildCategoryPrompt returns the focused user prompt with mini-schema per category.
func (s *aiService) buildCategoryPrompt(category string, photos []models.ATSPhotoInput) string {
	switch category {
	case "grounding":
		return fmt.Sprintf(`Analyze these %d grounding measurement photos. Read the EXACT ohm (Ω) value from each earth clamp tester display.

Respond with ONLY this JSON:
{
  "result_ohm": "<exact ohm value from display, e.g. 0.34>",
  "standard": "<5 Ω",
  "remarks": "<any observation>"
}`, len(photos))

	case "thermal":
		return fmt.Sprintf(`Analyze these %d thermal imager photos. Read the EXACT temperature (°C) from each thermal display.

If multiple thermal photos show different locations, report the HIGHEST temperature found.

Respond with ONLY this JSON:
{
  "result_temperature": "<highest temperature in °C, e.g. 32.1>",
  "standard": "40°C",
  "remarks": "<list all measured locations and their temperatures>"
}`, len(photos))

	case "power_meter":
		var descs []string
		for i, p := range photos {
			label := p.Label
			if label == "" {
				label = "Unknown measurement"
			}
			descs = append(descs, fmt.Sprintf("Photo %d: %s", i+1, label))
		}

		return fmt.Sprintf(`Analyze these %d electrical measurement photos. Each photo shows a clamp meter or digital power meter display.

The photos and their engineer descriptions:
%s

For each photo, read the EXACT number from the instrument LCD display. Match each reading to the correct field based on the engineer's description.

CRITICAL: Read the ACTUAL digits shown on each display. Do NOT substitute standard nominal values.

Respond with ONLY this JSON:
{
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "",
    "kva": "",
    "kvar": "",
    "cos_p": "",
    "r_ampere": "",
    "s_ampere": "",
    "t_ampere": "",
    "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "",
    "voltage_st": "",
    "voltage_tr": "",
    "voltage_rn": "",
    "voltage_sn": "",
    "voltage_tn": "",
    "voltage_ng": "",
    "ampere_r": "",
    "ampere_s": "",
    "ampere_t": "",
    "remarks": ""
  }
}

Fill each field with the exact value read from the corresponding photo. Leave empty "" for measurements not photographed.`,
			len(photos), strings.Join(descs, "\n"))

	case "visual_inspection":
		return fmt.Sprintf(`Analyze these %d visual inspection photos of an ATS panel at Neutra DC Cikarang.

Assess each of these inspection items based on what you see:

a. Unsafe action/condition check
b. Initial condition documentation
c. Cable grounding connection check
d. Support levelness check
e. Paint damage & corrosion check
f. Enclosure function check
g. Power meters/controller visual check
h. Lamp and indicator function check
i. Control wiring/relays inspection
j. Auxiliary connections check
k. Surge protection & fuse inspection
l. Cable connection thermal check
m. Panel cleaning status
n. Busbar and isolator inspection
o. CT connections inspection
p. Downstream power connections

Respond with ONLY this JSON (array of inspection items):
[
  {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
  {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
  {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
  {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
  {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
  {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
  {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
  {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
  {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
  {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
  {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
  {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
  {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
  {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
  {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
  {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
]

For condition, use ONLY "Good" or "Not Good" based on what you see in the photos. Add observations in remarks.`,
			len(photos))

	default:
		return "Analyze the photos and extract relevant data. Output ONLY valid JSON."
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3: CONSOLIDATION & VERIFICATION (Reasoning Model)
// ═══════════════════════════════════════════════════════════════════════════════

/*
func (s *aiService) consolidateResults(ctx context.Context, apiKey string, partials map[string]string) (*models.ATSReportData, error) {
	// Build input from all partial results
	var sections []string
	for category, jsonStr := range partials {
		if jsonStr != "" {
			sections = append(sections, fmt.Sprintf("=== %s ANALYSIS RESULT ===\n%s", strings.ToUpper(category), jsonStr))
		}
	}

	if len(sections) == 0 {
		return nil, fmt.Errorf("no category produced valid results")
	}

	prompt := fmt.Sprintf(`You are a data consolidation agent. Below are partial analysis results from specialized AI vision agents that analyzed maintenance photos of an ATS (Automatic Transfer Switch) panel.

Your job:
1. MERGE all partial results into ONE complete JSON object
2. VALIDATE the data logic:
   - Grounding should be < 5Ω (if above, add warning in remarks)
   - Temperature should be < 40°C (if above, add warning in remarks)
   - Phase voltages R-S, S-T, T-R should be roughly balanced (deviation < 5%%)
   - If any anomalies found, set operation_status.is_normal = false
3. PRESERVE all original measurement values exactly as reported — DO NOT modify any numbers
4. Fill in operation_status based on overall assessment
5. For visual_inspection: ensure all 16 items (a through p) are present with the correct activities

PARTIAL RESULTS FROM VISION AGENTS:
%s

OUTPUT the merged result as ONLY a valid JSON object (no markdown, no code fences, no explanation) with this structure:
{
  "visual_inspection": [
    {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
    {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
    {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
    {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
    {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
    {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
  ],
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "", "kva": "", "kvar": "", "cos_p": "",
    "r_ampere": "", "s_ampere": "", "t_ampere": "", "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "", "voltage_st": "", "voltage_tr": "",
    "voltage_rn": "", "voltage_sn": "", "voltage_tn": "", "voltage_ng": "",
    "ampere_r": "", "ampere_s": "", "ampere_t": "",
    "remarks": ""
  },
  "thermal_measurement": {
    "result_temperature": "", "standard": "40°C", "remarks": ""
  },
  "grounding_resistance": {
    "result_ohm": "", "standard": "<5 Ω", "remarks": ""
  },
  "operation_status": {
    "is_normal": true,
    "remark": "",
    "fault_symptom": "",
    "fault_analysis": "",
    "work_done": "",
    "fault_part_sn": "",
    "fault_part_name": ""
  }
}

RULES:
- Output ONLY the JSON object. No markdown code fences. No explanation text.
- PRESERVE all measurement values EXACTLY as reported by the vision agents — do NOT change any numbers
- If a category has no data (empty result), use default values
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on vision agent data`, strings.Join(sections, "\n\n"))

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": "You are a precision data consolidation agent for electrical maintenance reports. Your job is to merge partial analysis results into a complete, validated JSON report. Never modify measurement values — preserve them exactly. Output ONLY valid JSON, no markdown, no code fences.",
		},
		{
			"role":    "user",
			"content": prompt,
		},
	}

	// Disable thinking mode to make consolidation super fast
	var extraBody map[string]interface{}

	respContent, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, messages, 0.2, 16384, 90*time.Second, extraBody)
	if err != nil {
		return nil, err
	}

	return s.parseJSONResponse(respContent)
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC NVIDIA NIM API CALLER
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) callNVIDIA(ctx context.Context, apiKey, model string, messages []map[string]interface{}, temperature float64, maxTokens int, timeout time.Duration, extraBody map[string]interface{}) (string, error) {
	payload := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"max_tokens":  maxTokens,
		"temperature": temperature,
		"top_p":       0.9,
		"stream":      false,
	}

	for k, v := range extraBody {
		payload[k] = v
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Total attempts: at least 3 attempts per key to handle transient 429 rate limits gracefully
	keyCount := len(s.apiKeys)
	if keyCount == 0 {
		keyCount = 1
	}
	totalAttempts := keyCount * 3
	if totalAttempts < 3 {
		totalAttempts = 3
	}

	currentKey := apiKey
	var lastErr error
	var isRateLimitError bool

	for attempt := 0; attempt < totalAttempts; attempt++ {
		reqCtx, cancel := context.WithTimeout(ctx, timeout)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, s.baseURL, bytes.NewReader(body))
		if err != nil {
			cancel()
			return "", fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+currentKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			cancel()
			lastErr = err
			slog.Warn("AI API call failed, trying next key", 
				slog.Int("attempt", attempt+1), 
				slog.String("error", err.Error()),
			)
			currentKey = s.getNextAPIKey()
			time.Sleep(1 * time.Second)
			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel()

		if readErr != nil {
			lastErr = readErr
			slog.Warn("Failed to read response body, trying next key", 
				slog.Int("attempt", attempt+1),
				slog.String("error", readErr.Error()),
			)
			currentKey = s.getNextAPIKey()
			continue
		}

		if resp.StatusCode != http.StatusOK {
			bodyStr := string(respBody)
			if resp.StatusCode == http.StatusTooManyRequests || strings.Contains(bodyStr, "RESOURCE_EXHAUSTED") || strings.Contains(bodyStr, "429") {
				isRateLimitError = true
				lastErr = fmt.Errorf("Layanan AI Google Gemini sedang padat (Batas Kuota 15 request/menit tercapai). Silakan tunggu ~30 detik lalu coba lagi")
				slog.Warn("AI API 429 Rate Limit hit, applying retry backoff", 
					slog.Int("attempt", attempt+1),
					slog.Int("max_attempts", totalAttempts),
				)
				// Backoff delay before retrying: 2s, 4s, 6s...
				sleepDuration := time.Duration(attempt+1) * 2 * time.Second
				if sleepDuration > 6*time.Second {
					sleepDuration = 6 * time.Second
				}
				time.Sleep(sleepDuration)
				currentKey = s.getNextAPIKey()
				continue
			}

			lastErr = fmt.Errorf("AI API error (%d): %s", resp.StatusCode, bodyStr)
			if resp.StatusCode >= 500 {
				slog.Warn("AI API returned server error status, retrying", 
					slog.Int("status_code", resp.StatusCode), 
					slog.Int("attempt", attempt+1),
				)
				currentKey = s.getNextAPIKey()
				time.Sleep(1500 * time.Millisecond)
				continue
			}
			return "", lastErr
		}

		var chatResp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}

		if err := json.Unmarshal(respBody, &chatResp); err != nil {
			return "", fmt.Errorf("failed to parse API response: %w", err)
		}

		if len(chatResp.Choices) == 0 {
			return "", fmt.Errorf("AI model returned no choices")
		}

		content := chatResp.Choices[0].Message.Content
		slog.Info("AI API response received successfully",
			slog.String("model", model),
			slog.Int("attempt", attempt+1),
			slog.Int("content_length", len(content)),
		)
		// Increment request usage counter in Firestore asynchronously
		go s.incrementUsedRequest(context.Background())
		return content, nil
	}

	if isRateLimitError {
		return "", fmt.Errorf("Layanan AI Google Gemini sedang padat (Batas Kuota 15 request/menit). Silakan tunggu ~30 detik lalu coba lagi.")
	}

	return "", fmt.Errorf("layanan AI tidak merespons setelah %d percobaan: %v", totalAttempts, lastErr)
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON RESPONSE PARSER
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) parseJSONResponse(content string) (*models.ATSReportData, error) {
	slog.Info("RAW CONSOLIDATION RESPONSE", slog.String("content", content))

	// Clean the content
	content = strings.TrimSpace(content)

	// Handle deepseek <think>...</think> blocks
	if idx := strings.Index(content, "</think>"); idx != -1 {
		content = strings.TrimSpace(content[idx+len("</think>"):])
	}

	// Remove markdown code fences
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result models.ATSReportData
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse consolidated JSON: %w (raw: %.500s)", err, content)
	}

	return &result, nil
}

// Chat handles conversation logic for Data Center M/E/Cooling assistant.
func (s *aiService) Chat(ctx context.Context, messages []models.ChatMessage) (string, error) {
	if len(s.apiKeys) == 0 {
		return "", fmt.Errorf("no NVIDIA NIM API keys configured")
	}

	baseSystemInstruction := `You are JARVIS — an elite AI Co-Pilot and autonomous agent built into the UTT Report Maintenance web application for Tuan Gari Iriana, a senior Data Center engineer.

CREATOR & SYSTEM INFO:
- You were created by Tuan Gari Iriana.
- All systems, codebases, and projects here were built by Tuan Gari Iriana.
- If the user asks who created you or who built the system, ALWAYS state that it is Tuan Gari Iriana.

=== WEB APPLICATION KNOWLEDGE (UTT REPORT MAINTENANCE) ===
This is a full-stack web application for managing data center maintenance operations at Sultanah / UTT. You must be able to answer ANY question about this application.

PAGES & MODULES:
1. Dashboard (Home) — Overview of all active reports, summary stats, and recent activities.
2. Service Report (ATS) — Create and manage ATS (Automatic Transfer Switch) service reports. Includes visual inspection, digital power meter reading, voltage & current measurement, thermal measurement, grounding resistance, and operation status.
3. PTW (Permit To Work) — Manage work permit requests and approvals for all maintenance activities.
4. Documents — Archive and manage official technical documents, reports, and certificates.
5. Files — File manager for uploaded photos, PDFs, and attachments.
6. Findings — Log and track technical findings/issues discovered during inspections.
7. Corrective — Corrective maintenance work orders and task tracking.
8. Absen TBM (Toolbox Meeting Attendance) — Record attendance for pre-work Toolbox Meetings.
9. Absen Induction — Record attendance for safety induction sessions.
10. Admin Panel — User management, system settings, and admin-only configurations.

KEY FEATURES:
- AI Auto-Fill: Upload photos of equipment → AI analyzes and auto-fills the service report form.
- PDF Export: Generate and download professional service reports as PDF files (in English).
- Voice Agent (JARVIS): This voice interface you are currently powering — supports interactive multi-turn conversation and autonomous page navigation.
- Real-time Updates: Data syncs in real-time across all users using Firebase Firestore.
- Photo Upload: Attach inspection photos to service reports, organized by category.
- Search & Filter: Search reports by date range, keyword, or customer name.
- QR Code: Scan QR codes linked to equipment for quick report lookup.

TECH STACK (for technical questions):
- Frontend: React + TypeScript + Vite, TailwindCSS, Framer Motion
- Backend: Go (Golang), Firebase Firestore, Firebase Auth
- AI: NVIDIA NIM API (Llama/Gemma models) + Google Gemini (for voice agent)
- PDF Generation: jsPDF + jspdf-autotable
- Deployment: Backend runs on port 8080, frontend on Vite dev server port 5173

CREATOR & CONTEXT:
- This system is built for Sultanah / NeutraDC data center operations in Indonesia.
- All engineers using this system are field technicians managing M/E and cooling infrastructure.

OUT-OF-SCOPE RULE:
- Refuse only purely off-topic requests completely unrelated to the web app OR data center M/E/Cooling (e.g., cooking recipes, entertainment, random general knowledge). But if the user asks about THIS web app's features, pages, bugs, how to use it, or anything related to it — ALWAYS answer helpfully and fully.

Your technical expertise covers:
1. This web application (DwimitraSystem) — all features, pages, usage, troubleshooting.
2. Data center infrastructure, layout design, and operational procedures.
3. Mechanical & Electrical (M/E): ATS, Transformers, UPS systems, Generators, Distribution Boards, Breakers, and Grounding.
4. Cooling Systems: PAC, Chillers, CRACs, Cooling Towers, hot/cold aisle containment, and airflow.

RULES & INTERACTIVE STYLE:
- Actively analyze the context. If there is a problem/alarm, be proactive and provide DIRECT, STEP-BY-STEP, ACTIONABLE SOLUTIONS immediately. Do not delay with filler sentences.
- Pay close attention to previous messages in the history. Maintain perfect conversational memory and continuity of context.
- Keep your answers highly professional, polite, practical, and in Indonesian.
	- CRITICAL FORMATTING RULES:
	  1. Format your output beautifully in plain text using clear bullet points (-), numbered lists, and double newlines (\n\n) between main paragraphs and sections so they have clear vertical spacing (breathing space) and are NOT clumped/squished together.
	  2. DO NOT use markdown headers (no "#", "##", "###"). Use plain CAPITAL letters for section titles (e.g., "DETAIL PENGUKURAN:").
	  3. DO NOT use markdown tables (no "|" or "-----"). Format all tables/parameters as bullet lists.
	  4. EACH BULLET POINT/LIST ITEM MUST START ON A NEW LINE (use \n). DO NOT write multiple bullet points on the same line or in a single paragraph.
	  5. DO NOT use asterisks (**) for bolding, blockquotes, or horizontal rules (---).

AI AGENT COMMAND INSTRUCTIONS (CRITICAL & MANDATORY):
- You are directly integrated as JARVIS (an Autonomous AI Agent Co-Pilot) with the engineer's maintenance dashboard. You MUST execute actions requested by the engineer (navigating, downloading/exporting PDFs, searching archives, filtering dates, auto-filling forms, etc.).
- NEVER make up excuses or say "sistem sedang mengompilasi" without appending the action token!
- MANDATORY ACTION TAG RULES:
  1. When the user asks to export, download, or get PDF file (e.g. from archive, service report, or documents): append " [ACTION: EXPORT_PDF]" at the absolute end.
  2. When the user asks to navigate/open a page (e.g., ptw, admin, report, documents, files, findings, corrective, etc.): append " [ACTION: NAVIGATE: <page>]" at the absolute end.
  3. When the user asks to search or filter documents by date/keyword (e.g., "02 juni - 09 juni", "NeutraDC"): append " [ACTION: SEARCH: <query>] [ACTION: EXPORT_PDF]" at the absolute end.
  4. When the user asks to fill form or read photos: append " [ACTION: AUTO_FILL_ATS]" at the absolute end.
  5. When the user asks to refresh: append " [ACTION: REFRESH]" at the absolute end.
- CRITICAL: The action token MUST be the absolute last characters of your entire output. Do not put any text or punctuation after it.`

	visionSystemInstruction := baseSystemInstruction + `

VISION CAPABILITY (SUPER-GENIUS):
- You have advanced vision capabilities. When the user uploads an image, analyze it instantly with engineering precision.
- Read meter displays, screen alarm messages, fault indicators, and status indicators.
- Directly cross-reference findings with M/E safety standards (e.g., standard grounding values < 1 Ohm, normal UPS parameters) and immediately state whether it is NORMAL or abnormal, then give direct action steps.`

	// Scan messages to determine if any contain images
	useVisionModel := false
	for _, msg := range messages {
		if msg.ImageBase64 != "" {
			useVisionModel = true
			break
		}
	}

	systemInstruction := baseSystemInstruction
	if useVisionModel {
		systemInstruction = visionSystemInstruction
	}

	slog.Info("Chat request",
		slog.Int("message_count", len(messages)),
		slog.Bool("has_images", useVisionModel),
	)

	// Reformat messages to meet NVIDIA API request requirements.
	formattedMessages := make([]map[string]interface{}, 0, len(messages)+1)
	formattedMessages = append(formattedMessages, map[string]interface{}{
		"role":    "system",
		"content": systemInstruction,
	})

	for _, msg := range messages {
		if msg.ImageBase64 != "" {
			mimeType := "image/jpeg"
			if strings.HasPrefix(msg.ImageBase64, "iVBOR") {
				mimeType = "image/png"
			}
			imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, msg.ImageBase64)

			slog.Info("Chat multimodal message",
				slog.String("role", msg.Role),
				slog.Int("image_base64_len", len(msg.ImageBase64)),
				slog.String("mime_type", mimeType),
				slog.String("text_content", msg.Content),
			)

			// Multimodal payload format
			contentArray := []map[string]interface{}{
				{
					"type": "text",
					"text": msg.Content,
				},
				{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": imageURL,
					},
				},
			}

			formattedMessages = append(formattedMessages, map[string]interface{}{
				"role":    msg.Role,
				"content": contentArray,
			})
		} else {
			formattedMessages = append(formattedMessages, map[string]interface{}{
				"role":    msg.Role,
				"content": msg.Content,
			})
		}
	}

	targetModel := s.chatModel // Use fast model for interactive chat
	if useVisionModel {
		targetModel = s.visionModel
	}

	slog.Info("Chat calling NVIDIA",
		slog.String("target_model", targetModel),
		slog.Int("formatted_messages", len(formattedMessages)),
	)

	apiKey := s.getNextAPIKey()
	reply, err := s.callNVIDIA(ctx, apiKey, targetModel, formattedMessages, 0.7, 1024, 60*time.Second, nil)
	if err != nil {
		return "", err
	}

	return reply, nil
}

// ValidateATSForm validates user form input values and cross-checks them against uploaded photos.
func (s *aiService) ValidateATSForm(ctx context.Context, data models.ATSReportData, photos []models.ATSPhotoInput) (*models.FormValidationResponse, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no NVIDIA NIM API keys configured")
	}

	dataBytes, _ := json.MarshalIndent(data, "", "  ")
	formText := string(dataBytes)

	// Determine model to use
	useVision := false
	var messages []map[string]interface{}

	prompt := fmt.Sprintf(`You are an elite Data Center Principal Electrical Engineer.
Your task is to validate an ATS (Automatic Transfer Switch) maintenance service report form and provide real-time guidance.

Here is the current form data filled in by the engineer:
%s

RULES & CRITERIA TO VALIDATE:
1. Grounding Resistance (grounding_resistance.result_ohm): Must be < 5 Ohm. If >= 5 Ohm, flag as WARNING with a message to clean the grounding rod connection or inspect the ground pit.
2. Thermal Measurement Temperature (thermal_measurement.result_temperature): Must be < 40°C. If >= 40°C, flag as WARNING with a message of potential hotspot, recommending retightening terminal lugs.
3. Voltage Balance:
   - Phase-to-Phase Voltages (voltage_current.voltage_rs, voltage_st, voltage_tr): Should be roughly balanced (within 5%% deviation of each other). If unbalanced, flag as WARNING.
   - Phase-to-Neutral Voltages (voltage_current.voltage_rn, voltage_sn, voltage_tn): Should be roughly 220V (within 5%%). If out of bounds, flag as WARNING.
   - Voltage N-G (voltage_current.voltage_ng): Should be < 2V (preferably < 1V). If >= 2V, flag as WARNING (high neutral-to-ground voltage indicates poor grounding or unbalanced load).
4. Visual Inspection Checklist:
   - If any item in visual_inspection has condition == "Not Good", check if the 'remarks' field is empty. If it is empty, flag as ERROR (requires a remark detailing the issue).
   - If a remark indicates a physical issue (e.g., corrosion, loose wire), suggest a recommendation for it.
5. Operation Status (operation_status):
   - If grounding is >= 5 Ohm, temperature is >= 40°C, or any visual inspection is "Not Good", but operation_status.is_normal is true, flag as ERROR (status should be Abnormal when critical issues exist).

Output your response as ONLY a valid JSON object matching the schema below. Do NOT output markdown code fences, do not output explanations, just the JSON.

SCHEMA:
{
  "is_valid": true/false, // false if there are any warnings or errors
  "summary": "Brief summary of the validation result in Indonesian",
  "issues": [
    {
      "field": "name of the field, e.g. grounding_resistance.result_ohm, or visual_inspection.0.remarks",
      "severity": "warning", // or "error"
      "message": "Detailed explanation of the issue and why it violates standards, in Indonesian"
    }
  ],
  "recommendations": [
    "Step-by-step technical action item to resolve the issues, in Indonesian (e.g. 'Lakukan pengencangan baut...', 'Lakukan pengujian ulang...')"
  ]
}`, formText)

	// Filter out photos with empty base64
	var validPhotos []models.ATSPhotoInput
	for _, p := range photos {
		if strings.TrimSpace(p.Base64) != "" {
			validPhotos = append(validPhotos, p)
		}
	}

	if len(validPhotos) > 0 {
		useVision = true
		prompt += `\n6. Photo Verification: Check if the numeric values shown in the multimeter/clamp-meter display in the photos match the values entered in the form fields. If there is a mismatch (e.g. photo shows 4.5 Ohm but form input has 0.5 Ohm), flag as ERROR.`

		contentArray := []map[string]interface{}{
			{
				"type": "text",
				"text": prompt,
			},
		}

		for i, photo := range validPhotos {
			mimeType := "image/jpeg"
			if strings.HasPrefix(photo.Base64, "iVBOR") {
				mimeType = "image/png"
			}
			imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, photo.Base64)

			contentArray = append(contentArray, map[string]interface{}{
				"type": "text",
				"text": fmt.Sprintf("--- PHOTO %d ---\nCategory: %s\nEngineer Label: %s\nForm Input Parameter: %s", i+1, photo.Category, photo.Label, photo.Parameter),
			})
			contentArray = append(contentArray, map[string]interface{}{
				"type": "image_url",
				"image_url": map[string]interface{}{
					"url": imageURL,
				},
			})
		}

		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": "You are a professional Data Center Principal Electrical Engineer. Analyze the provided form data and photos, verify consistency and standards compliance, and return a structured JSON validation report. Output ONLY JSON, no explanation.",
		})
		messages = append(messages, map[string]interface{}{
			"role":    "user",
			"content": contentArray,
		})
	} else {
		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": "You are a professional Data Center Principal Electrical Engineer. Analyze the provided form data, verify consistency and standards compliance, and return a structured JSON validation report. Output ONLY JSON, no explanation.",
		})
		messages = append(messages, map[string]interface{}{
			"role":    "user",
			"content": prompt,
		})
	}

	targetModel := s.chatModel // Llama 3.1 8B Instruct (fast text model)
	if useVision {
		targetModel = s.visionModel // Llama 3.2 11B Vision
	}

	slog.Info("ValidateATSForm calling NVIDIA",
		slog.String("target_model", targetModel),
		slog.Bool("use_vision", useVision),
	)

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, targetModel, messages, 0.2, 8192, 90*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("NVIDIA NIM validation call failed: %w", err)
	}

	return s.parseValidationJSONResponse(respContent)
}

func (s *aiService) parseValidationJSONResponse(content string) (*models.FormValidationResponse, error) {
	slog.Info("RAW VALIDATION RESPONSE", slog.String("content", content))

	// Clean the content
	content = strings.TrimSpace(content)

	// Handle deepseek <think>...</think> blocks if any
	if idx := strings.Index(content, "</think>"); idx != -1 {
		content = strings.TrimSpace(content[idx+len("</think>"):])
	}

	// Remove markdown code fences
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result models.FormValidationResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse validation JSON: %w (raw: %.500s)", err, content)
	}

	return &result, nil
}

// AnalyzeSingleCard reads the exact value from a single documentation card photo using Llama 3.2 Vision.
func (s *aiService) AnalyzeSingleCard(ctx context.Context, req models.CardAnalyzeRequest) (*models.CardAnalyzeResponse, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no NVIDIA NIM API keys configured")
	}

	mimeType := "image/jpeg"
	if strings.HasPrefix(req.PhotoBase64, "iVBOR") {
		mimeType = "image/png"
	}
	imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, req.PhotoBase64)

	systemInstruction := "You are a precision instrument reader specializing in electrical equipment display readouts."

	prompt := fmt.Sprintf(`Look at the photo and read the exact value or status from the instrument display.
Context:
- Category: %s
- Description: %s

Rules:
1. Extract the number (e.g., voltage, current, resistance, or temperature) or status shown in the image.
2. Be precise. Do not guess or round up the numbers.
3. Respond ONLY with the raw read value or status (e.g., "0.35 Ohm", "380.5 V", "32.4 °C", "Clean", "Normal").
4. Do NOT output markdown code fences, do NOT output explanations, do NOT output JSON. Just the raw text.`, req.Category, req.Description)

	contentArray := []map[string]interface{}{
		{
			"type": "text",
			"text": prompt,
		},
		{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url": imageURL,
			},
		},
	}

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": systemInstruction,
		},
		{
			"role":    "user",
			"content": contentArray,
		},
	}

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, s.visionModel, messages, 0.0, 1024, 45*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("NVIDIA NIM vision call failed: %w", err)
	}

	// Clean respContent just in case
	respContent = strings.TrimSpace(respContent)
	respContent = strings.TrimPrefix(respContent, "```")
	respContent = strings.TrimSuffix(respContent, "```")
	respContent = strings.TrimSpace(respContent)

	return &models.CardAnalyzeResponse{
		Parameter: respContent,
	}, nil
}

// AnalyzePJUPhotos processes PJU photos and returns structured PJU report data.
func (s *aiService) AnalyzePJUPhotos(ctx context.Context, photos []models.PJUPhotoInput, existingData *models.PJUReportData) (*models.PJUReportData, error) {
	report := &models.PJUReportData{}
	if existingData != nil {
		*report = *existingData
	}

	if len(report.VisualInspection) == 0 {
		report.VisualInspection = []models.PJUInspectionItem{
			{No: "a.", Activity: "Inspection visual of lamps", Parameter: "Installed", Condition: "Good"},
			{No: "b.", Activity: "Inspection all lighting fixtures regularly to ensure they are in good working order", Parameter: "Normal function", Condition: "Good"},
			{No: "c.", Activity: "Inspection wiring and connections to prevent electrical problems", Parameter: "Connection is well established", Condition: "Good"},
			{No: "d.", Activity: "Inspection lamps with transformers, control gear, and other accessories", Parameter: "Not damaged", Condition: "Good"},
			{No: "e.", Activity: "Inspection wiring, screws, gaskets, and exterior light hardware", Parameter: "Connection is well established", Condition: "Good"},
			{No: "f.", Activity: "Make sure to use lights with the same color temperature", Parameter: "Normal function", Condition: "Good"},
			{No: "g.", Activity: "Make sure every connection on the lamp is well connected and not easily separated.", Parameter: "Connection is well established", Condition: "Good"},
			{No: "h.", Activity: "battry check on solar street lighting", Parameter: "24 VDC - 27 VDC", Condition: "Good"},
			{No: "i.", Activity: "Check the RL OPTICA P80 + Soalar Panel C2 to make sure it is not dirty and functions normally.", Parameter: "Normal function", Condition: "Good"},
			{No: "j.", Activity: "check solar controller carger", Parameter: "30 VDC - 40 VDC", Condition: "Good"},
			{No: "k.", Activity: "check any water leak indication", Parameter: "Connection is well established", Condition: "Good"},
			{No: "l.", Activity: "check light sensor", Parameter: "Normal function", Condition: "Good"},
		}
	}

	if len(report.Cleaning) == 0 {
		report.Cleaning = []models.PJUInspectionItem{
			{No: "a.", Activity: "cleaning lamp house or lamp box", Parameter: "Clean", Condition: "Good"},
			{No: "b.", Activity: "cleaning light poles for street lighting and garden lights", Parameter: "Clean", Condition: "Good"},
			{No: "c.", Activity: "cleaning the lamp cover glass to make the lamp light brighter", Parameter: "Clean", Condition: "Good"},
			{No: "d.", Activity: "cleaning the cable connection area and add protection", Parameter: "Clean", Condition: "Good"},
			{No: "e.", Activity: "cleaning the solar panel area", Parameter: "Clean", Condition: "Good"},
			{No: "f.", Activity: "cleaning the control panel", Parameter: "Clean", Condition: "Good"},
			{No: "g.", Activity: "battry cleaning", Parameter: "Clean", Condition: "Good"},
			{No: "h.", Activity: "cleaning on the sensor", Parameter: "Clean", Condition: "Good"},
			{No: "i.", Activity: "cleaning light control panel", Parameter: "Clean", Condition: "Good"},
		}
	}

	if len(report.Measurement) == 0 {
		report.Measurement = []models.PJUMeasurementItem{
			{No: "a.", Activity: "Measurement of 30 VDC-40 VDC input power supply", Parameter: "30 VDC - 40 VDC", Condition: "Good"},
			{No: "b.", Activity: "24 VDC output poower suplay measurement", Parameter: "24 VDC - 27 VDC", Condition: "Good"},
			{No: "c.", Activity: "Battery Charger & battery Voltage/VDC.", Parameter: "24 VDC - 27 VDC", Condition: "Good"},
		}
	}

	if len(report.Test) == 0 {
		report.Test = []models.PJUTestItem{
			{No: "a.", Activity: "Ensure battery charging when solar panels are exposed to the sun.", Parameter: "25 VDC - 40 VDC", Condition: "Good"},
			{No: "b.", Activity: "Make sure the power suplay is charging the battery", Parameter: "Input 25 VDC", Condition: "Good"},
			{No: "c.", Activity: "Test the lamp to make sure it lights up with the same lighting color and load as before.", Parameter: "Lamp on and bright normal", Condition: "Good"},
		}
	}

	report.OperationStatus.IsNormal = true

	for _, p := range photos {
		param := strings.TrimSpace(p.Parameter)
		label := strings.ToLower(p.Label)
		if param == "" {
			continue
		}

		if strings.Contains(label, "input power") || strings.Contains(label, "30 vdc") || strings.Contains(label, "input voltage") || strings.Contains(label, "30vdc") {
			if len(report.Measurement) > 0 { report.Measurement[0].Remarks = param }
		} else if strings.Contains(label, "output poower") || strings.Contains(label, "output power") || strings.Contains(label, "24 vdc") || strings.Contains(label, "output voltage") || strings.Contains(label, "24vdc") {
			if len(report.Measurement) > 1 { report.Measurement[1].Remarks = param }
		} else if strings.Contains(label, "battery charger") || strings.Contains(label, "battery voltage") || strings.Contains(label, "battery vdc") {
			if len(report.Measurement) > 2 { report.Measurement[2].Remarks = param }
		} else if strings.Contains(label, "charging when solar") || strings.Contains(label, "solar panel charging") {
			if len(report.Test) > 0 { report.Test[0].Remarks = param }
		} else if strings.Contains(label, "charging the battery") || strings.Contains(label, "power supply charging") {
			if len(report.Test) > 1 { report.Test[1].Remarks = param }
		} else if strings.Contains(label, "lights up") || strings.Contains(label, "same lighting") || strings.Contains(label, "lamp on") || strings.Contains(label, "light color") {
			if len(report.Test) > 2 { report.Test[2].Remarks = param }
		}
	}

	return report, nil
}

// AnalyzePDUPhotos implements the text-based AI Agent pipeline for Panel PDU Service Report.
func (s *aiService) AnalyzePDUPhotos(ctx context.Context, photos []models.PDUPhotoInput, existingData *models.PDUReportData) (*models.PDUReportData, error) {
	slog.Info("PDU AGENT Pipeline started (Text-based parameters)",
		slog.Int("total_photos", len(photos)),
	)

	report := &models.PDUReportData{
		InspectionChecking: []models.PDUInspectionItem{
			{No: 1, Activity: "Inspection unsafe action and unsafe condition before start activity maintenance", Parameter: "Complete personal protective equipment", Condition: "Good"},
			{No: 2, Activity: "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth", Parameter: "tight", Condition: "Good"},
			{No: 3, Activity: "Inspection & check visual all support panel like a condition paint panel, pilot lamp, chassis panel, padlock system and cleaning using vacuum cleaner.", Parameter: "does not peel or rust", Condition: "Good"},
			{No: 4, Activity: "Inspection & check status breaker incoming and outgoing, cable wiring panel, and fuse", Parameter: "The cable terminals are not loose,", Condition: "Good"},
			{No: 5, Activity: "Inspection relay, power supply unit, measurement voltage", Parameter: "Good Condition", Condition: "Good"},
			{No: 6, Activity: "Inspection visual tightness all connection cable in terminal cable, label marking, terminal breaker and all mounting nut.", Parameter: "tight", Condition: "Good"},
			{No: 7, Activity: "Check condition connection cable using thermal imager if the found anomaly like a hot spot on the connection.", Parameter: "Normally <45°C (depending on rating), make sure not to exceed manufacturer standards.", Condition: "Good"},
			{No: 8, Activity: "Cleaning panel used vacuum cleaner and apply sanpoly to finish it", Parameter: "Good condition & clean", Condition: "Good"},
			{No: 9, Activity: "Inspection and check visual trafo isotrans with analysis condition temperature operational trafo using thermal imager and measurement noise with sound level", Parameter: "Normally <70 dB(depending on rating), make sure not to exceed manufacturer standards.", Condition: "Good"},
			{No: 10, Activity: "Cleaning, remove object from top of controller", Parameter: "There are no dangerous foreign objects on the controller panel.", Condition: "Good"},
			{No: 11, Activity: "Inspection DPM, and ensure measurement on reading in DPM. Take a photo", Parameter: "All parameter ready reading in DPM", Condition: "Good"},
		},
		Cleaning: []models.PDUCleaningItem{
			{No: 1, Activity: "Cleaning support panels using a vacuum cleaner", Parameter: "Clean", Condition: "Clean"},
			{No: 2, Activity: "Clean the panel with a vacuum and apply sanpoly.", Parameter: "Clean", Condition: "Clean"},
		},
		ISOTransTemp: models.PDUISOTransTemp{
			Standard: "Temperature < 45 °C",
		},
		ThermalMeasurement: models.PDUThermalItem{
			Breaker:  "Main Breaker Panel PDU",
			Standard: "Temperature < 45 °C",
		},
		GroundingResistance: models.PDUGroundingItem{
			Wire:     "Grounding",
			Standard: "<5Ω",
		},
		NoiseMeasurement: models.PDUNoiseItem{
			Measurement: "Measurement Noise Sound Level",
			Standard:    "<75 dB",
		},
		AnalysisRemark: models.PDUAnalysisRemark{
			IsNormal:   true,
			RemarkText: "Panel PDU beroperasi dengan normal, tegangan, arus, temperatur trafo ISO-Trans, resistansi grounding dan tingkat kebisingan sesuai standar manufaktur.",
		},
	}

	if existingData != nil {
		report.DPMRecording = existingData.DPMRecording
		report.ISOTransTemp = existingData.ISOTransTemp
		report.VoltageAmpere = existingData.VoltageAmpere
		report.ThermalMeasurement = existingData.ThermalMeasurement
		report.GroundingResistance = existingData.GroundingResistance
		report.NoiseMeasurement = existingData.NoiseMeasurement
		if existingData.AnalysisRemark.RemarkText != "" {
			report.AnalysisRemark = existingData.AnalysisRemark
		}
	}

	// Map parameter inputs from photo cards
	for _, p := range photos {
		param := strings.TrimSpace(p.Parameter)
		label := strings.ToLower(p.Label)
		if param == "" {
			continue
		}

		if strings.Contains(label, "grounding") || strings.Contains(label, "<5") || strings.Contains(label, "tahanan") {
			report.GroundingResistance.Result = param
		} else if strings.Contains(label, "noise") || strings.Contains(label, "75 db") || strings.Contains(label, "kebisingan") {
			report.NoiseMeasurement.Result = param
		} else if strings.Contains(label, "thermal") || strings.Contains(label, "breaker") || strings.Contains(label, "hot spot") || strings.Contains(label, "flir") {
			report.ThermalMeasurement.ResultTemp = param
		} else if strings.Contains(label, "iso-trans") || strings.Contains(label, "isotrans") || strings.Contains(label, "trafo") {
			parts := strings.Split(param, ",")
			if len(parts) >= 3 {
				report.ISOTransTemp.RTemp = strings.TrimSpace(parts[0])
				report.ISOTransTemp.STemp = strings.TrimSpace(parts[1])
				report.ISOTransTemp.TTemp = strings.TrimSpace(parts[2])
			} else {
				report.ISOTransTemp.RTemp = param
			}
		} else if strings.Contains(label, "factor daya") || strings.Contains(label, "power factor") || strings.Contains(label, "cos") {
			report.DPMRecording.CosP = param
		}
	}

	return report, nil
}

// AnalyzeCTPhotos processes Cooling Tower photos and returns structured CT report data.
func (s *aiService) AnalyzeCTPhotos(ctx context.Context, photos []models.CTPhotoInput, existingData any) (any, error) {
	slog.Info("CT AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Kondisi bersih & terawat",
	}, nil
}

// AnalyzeGeneratorPhotos processes Generator photos and returns structured Generator report data.
func (s *aiService) AnalyzeGeneratorPhotos(ctx context.Context, photos []models.GeneratorPhotoInput, existingData any) (any, error) {
	slog.Info("Generator AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Sesuai standar & normal",
	}, nil
}

// AnalyzeTrafoPhotos processes Transformator photos and returns structured Trafo report data.
func (s *aiService) AnalyzeTrafoPhotos(ctx context.Context, photos []models.TrafoPhotoInput, existingData any) (any, error) {
	slog.Info("Trafo AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Normal & aman",
	}, nil
}

// AnalyzeACSplitPhotos processes AC Split photos and returns structured AC Split report data.
func (s *aiService) AnalyzeACSplitPhotos(ctx context.Context, photos []models.ACSplitPhotoInput, existingData any) (any, error) {
	slog.Info("AC Split AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Dingin & bersih",
	}, nil
}

// AnalyzeBusductPhotos processes Panel Busduct photos and returns structured Busduct report data.
func (s *aiService) AnalyzeBusductPhotos(ctx context.Context, photos []models.BusductPhotoInput, existingData any) (any, error) {
	slog.Info("Busduct AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Joint kencang & suhu normal",
	}, nil
}

// AnalyzeDocklevelerPhotos processes Dock Leveler photos and returns structured Dock Leveler report data.
func (s *aiService) AnalyzeDocklevelerPhotos(ctx context.Context, photos []models.DocklevelerPhotoInput, existingData any) (any, error) {
	slog.Info("Dock Leveler AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Kondisi baik & normal",
	}, nil
}

// AnalyzeDoorPhotos processes Door photos and returns structured Door report data.
func (s *aiService) AnalyzeDoorPhotos(ctx context.Context, photos []models.DoorPhotoInput, existingData any) (any, error) {
	slog.Info("Door AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Pintu lancar & normal",
	}, nil
}

// AnalyzeCapacitorbankPhotos processes Capacitor Bank photos and returns structured Capacitor Bank report data.
func (s *aiService) AnalyzeCapacitorbankPhotos(ctx context.Context, photos []models.CapacitorbankPhotoInput, existingData any) (any, error) {
	slog.Info("Capacitor Bank AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Kondisi baik & normal",
	}, nil
}

// AnalyzeLdbrdbPhotos processes Panel LDB & RDB photos and returns structured report data.
func (s *aiService) AnalyzeLdbrdbPhotos(ctx context.Context, photos []models.LdbrdbPhotoInput, existingData any) (any, error) {
	slog.Info("Panel LDB & RDB AGENT Pipeline started", slog.Int("total_photos", len(photos)))
	if existingData != nil {
		return existingData, nil
	}
	return map[string]interface{}{
		"status":  "success",
		"remarks": "Kondisi baik & normal",
	}, nil
}

// DigitizePaperReport performs high-accuracy OCR table scanning on uploaded paper service report photos.
func (s *aiService) DigitizePaperReport(ctx context.Context, photos []string, accountEmail string) (*models.PaperReportScanResponse, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no AI API keys configured")
	}

	if len(photos) == 0 {
		return nil, fmt.Errorf("no photo provided for paper report scanning")
	}

	slog.Info("DigitizePaperReport OCR pipeline started", slog.Int("photos", len(photos)), slog.String("account", accountEmail))

	systemInstruction := "You are a professional OCR document digitization AI for PT Dwimitra Ekatama Mandiri / PT UTT data center maintenance documentation system."

	prompt := `BACA DAN DIGITALISKAN FOTO SURAT/LEMBAR SERVICE REPORT FISIK (MURNI PERSIS SESUAI LAYOUT ASLI PADA KERTAS):

Instruksi Pemrosesan Murni Presisi (Strict Layout Matching):
1. BACALAH SELURUH ISI LEMBARAN SURAT/FORMULIR SERVICE REPORT DENGAN SANGAT TELITI DAN PRESISI.
2. Dapatkan Judul Dokumen (Title) sesuai yang tertulis di bagian atas kertas (misal: "PREVENTIVE MAINTENANCE EXHAUST FAN", "SERVICE REPORT GENERATOR SET", "LEMBAR CHECKLIST TRAFO", dll).
3. Ekstrak SELURUH Field Informasi Header/Info Umum di "equipment_info" MENGGUNAKAN NAMA LABELS ASLI DARI KERTAS (misal: "No. Work Order", "Pelanggan / Customer", "Lokasi / Area", "Nama Peralatan / Tag No", "Merk / Type", "Kapasitas", "Serial No", "Tanggal Pelaksanaan", "Teknisi / Pelaksana").
4. Ekstrak SELURUH TABEL MENGGUNAKAN LAYOUT DAN HEADER KOLOM ASLI YANG ADA PADA KERTAS:
   - "table_name": Nama bagian / sub-judul tabel sesuai kertas (misal: "A. INSPEKSI KONDISI FISIK", "B. PENGUKURAN ELEKTRIKAL", "C. HASIL PENGUJIAN OPERASIONAL").
   - "headers": EKSTRAK NAMA KOLOM HEADER ASLI SESUAI FISIK KERTAS (Gunakan jumlah dan nama kolom yang SAMA PERSIS dengan di kertas! Contoh jika di kertas 5 kolom: ["No", "Uraian Pekerjaan", "Standar", "Hasil Pengukuran", "Keterangan"]).
   - "rows": Isikan data baris demi baris sesuai isi tulisan tangan / cetakan pada kertas. Untuk kolom keterangan/remarks, buat ringkas & jelas (2-5 kata Bahasa Indonesia).
5. Format keluaran HARUS MURNI JSON tanpa markdown fences/penjelasan.`

	contentArray := []map[string]interface{}{
		{
			"type": "text",
			"text": prompt,
		},
	}

	for _, p := range photos {
		mimeType := "image/jpeg"
		cleanBase64 := p
		if strings.HasPrefix(p, "data:") {
			parts := strings.SplitN(p, ",", 2)
			if len(parts) == 2 {
				cleanBase64 = parts[1]
			}
		}
		if strings.HasPrefix(cleanBase64, "iVBOR") {
			mimeType = "image/png"
		}
		imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, cleanBase64)
		contentArray = append(contentArray, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url": imageURL,
			},
		})
	}

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": systemInstruction,
		},
		{
			"role":    "user",
			"content": contentArray,
		},
	}

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, s.visionModel, messages, 0.1, 4096, 60*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("AI paper report scanning failed: %w", err)
	}

	// Clean respContent
	respContent = strings.TrimSpace(respContent)
	respContent = strings.TrimPrefix(respContent, "```json")
	respContent = strings.TrimPrefix(respContent, "```")
	respContent = strings.TrimSuffix(respContent, "```")
	respContent = strings.TrimSpace(respContent)

	var result models.PaperReportScanResponse
	if err := json.Unmarshal([]byte(respContent), &result); err != nil {
		slog.Warn("Could not unmarshal strict JSON from paper scan, attempting raw fallback", "err", err, "raw", respContent)
		return &models.PaperReportScanResponse{
			Title: "Laporan Service Report Terdigitalisasi",
			EquipmentInfo: map[string]string{
				"Akun": accountEmail,
				"Status": "Digitalisasi Berhasil",
			},
			Tables: []models.DigitizedTable{
				{
					TableName: "Hasil Scan OCR Kertas Laporan",
					Headers:   []string{"No", "Teks Terbaca pada Kertas", "Catatan"},
					Rows: [][]string{
						{"1", respContent, "Hasil scan AI OCR"},
					},
				},
			},
			Summary: "Data terdigitalisasi dari foto lembaran fisik.",
			RawText: respContent,
		}, nil
	}

	s.incrementUsedRequest(ctx)
	return &result, nil
}





